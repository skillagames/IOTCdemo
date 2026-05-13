import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { addDays } from "date-fns";
import { handleFirestoreError, OperationType } from "../lib/utils";

export interface Device {
  id: string;
  serialNumber: string;
  imei: string;
  iccid: string;
  materialCode?: string;
  barcode?: string;
  name: string;
  description?: string;
  ownerId: string;
  subscriptionStatus: "active" | "expired" | "inactive";
  expirationDate: any;
  planId: string;
  lastUpdated: any;
  autoRenew?: boolean;
}

export interface UsageStat {
  id: string;
  timestamp: any;
  dataUsedMb: number;
  activeHours: number;
}

export const deviceService = {
  async getUserDevices(userId: string) {
    const path = "devices";
    try {
      const q = query(collection(db, path), where("ownerId", "==", userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Device,
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getDeviceById(deviceId: string) {
    const path = `devices/${deviceId}`;
    try {
      const docRef = doc(db, "devices", deviceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Device;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async registerDevice(
    data: Omit<
      Device,
      "id" | "subscriptionStatus" | "expirationDate" | "lastUpdated"
    >,
  ) {
    const path = "devices";
    try {
      const newDevice = {
        ...data,
        imei: (data as any).imei || "N/A",
        iccid: (data as any).iccid || "N/A",
        subscriptionStatus: "inactive", // New devices start as not active
        expirationDate: null, // No expiration yet
        lastUpdated: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, path), newDevice);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async verifyHardware(code: string) {
    const registryRef = collection(db, "master_registry");
    
    // Check Serial Number
    const qSN = query(registryRef, where("serialNumber", "==", code));
    const snapSN = await getDocs(qSN);
    if (!snapSN.empty) return snapSN.docs[0].data();

    // Check IMEI
    const qIMEI = query(registryRef, where("imei", "==", code));
    const snapIMEI = await getDocs(qIMEI);
    if (!snapIMEI.empty) return snapIMEI.docs[0].data();

    // Check Material Code
    const qMat = query(registryRef, where("materialCode", "==", code));
    const snapMat = await getDocs(qMat);
    if (!snapMat.empty) return snapMat.docs[0].data();

    // Check Barcode
    const qBar = query(registryRef, where("barcode", "==", code));
    const snapBar = await getDocs(qBar);
    if (!snapBar.empty) return snapBar.docs[0].data();

    return null;
  },

  async seedMasterRegistry() {
    // Only run if not already seeded in this session to prevent redundant network calls
    const isSeededInSession = sessionStorage.getItem("master_registry_seeded");
    if (isSeededInSession) return;

    try {
      const registryRef = collection(db, "master_registry");
      const devices = [
        {
          serialNumber: "6001237010828",
          imei: "358762109845321",
          iccid: "89014103211185101234",
          model: "IoT-Hub-X1",
          manufacturer: "IoTConnect Labs",
        },
        {
          imei: "869816053499231",
          serialNumber: "K78038990",
          materialCode: "303201410",
          barcode: "6931847166557",
          model: "DS-MCW407",
          description: "Body Camera",
          manufacturer: "Hikvision",
        }
      ];

      for (const deviceData of devices) {
        const q = query(
          registryRef,
          where("serialNumber", "==", deviceData.serialNumber),
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          await addDoc(registryRef, {
            ...deviceData,
            lastSeeded: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
      }

      sessionStorage.setItem("master_registry_seeded", "true");
    } catch (e) {
      console.warn(
        "Master Registry Sync: Only operators can provision global hardware keys.",
        e,
      );
    }
  },

  async renewSubscription(deviceId: string, days: number = 30) {
    const path = `devices/${deviceId}`;
    try {
      const deviceRef = doc(db, "devices", deviceId);
      await updateDoc(deviceRef, {
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), days),
        lastUpdated: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getUsageStats(deviceId: string) {
    const path = `devices/${deviceId}/usage`;
    try {
      const q = query(
        collection(db, "devices", deviceId, "usage"),
        orderBy("timestamp", "desc"),
        limit(30),
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          // Convert Firestore Timestamp to millis for better chart sorting/rendering
          const timestamp =
            data.timestamp?.toMillis?.() ||
            (data.timestamp?.seconds
              ? data.timestamp.seconds * 1000
              : Date.now());

          return {
            id: doc.id,
            ...data,
            timestamp,
          } as UsageStat;
        })
        .reverse();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async toggleAutoRenew(deviceId: string, enabled: boolean) {
    const path = `devices/${deviceId}`;
    try {
      const deviceRef = doc(db, "devices", deviceId);
      await updateDoc(deviceRef, {
        autoRenew: enabled,
        lastUpdated: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getAllDevices() {
    const path = "devices";
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Device,
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async syncTelemetry(deviceId: string) {
    const path = `devices/${deviceId}/usage`;
    try {
      const usageCollection = collection(db, "devices", deviceId, "usage");
      await addDoc(usageCollection, {
        timestamp: new Date(),
        dataUsedMb: Math.floor(Math.random() * 50) + 10,
        activeHours: 1,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async removeDevice(deviceId: string) {
    const path = `devices/${deviceId}`;
    try {
      const batch = writeBatch(db);

      // Delete usage subcollection
      const usageQ = await getDocs(
        collection(db, "devices", deviceId, "usage"),
      );
      usageQ.docs.forEach((usageDoc) => {
        batch.delete(usageDoc.ref);
      });

      // Delete the device itself
      batch.delete(doc(db, "devices", deviceId));

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async seedDeviceUsage(deviceId: string) {
    const usageCollection = collection(db, "devices", deviceId, "usage");
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));

      await addDoc(usageCollection, {
        timestamp: date,
        dataUsedMb: Math.floor(Math.random() * 450) + 50,
        activeHours: Math.floor(Math.random() * 12) + 2,
      });
    }
  },

  async seedDevices(userId: string) {
    const dummyDevices = [
      {
        name: "DS-2CD2043G0-I",
        description: "CCTV Camera",
        serialNumber: "C20210815AAWR12345",
        imei: "358762109845321",
        iccid: "89014103211185101234",
        materialCode: "303201410",
        barcode: "6931847166557",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 15),
      },
      {
        name: "DS-7204HQHI-K1",
        description: "DVR/NVR",
        serialNumber: "C20210920BBWR98765",
        imei: "862341056789123",
        iccid: "89441012345678901234",
        materialCode: "303201411",
        barcode: "6931847166558",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -5),
      },
      {
        name: "DS-KV8113-WME1",
        description: "Video Intercom",
        serialNumber: "C20211010CCWR54321",
        imei: "447788992233110",
        iccid: "89852033445566778899",
        materialCode: "303201412",
        barcode: "6931847166559",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 45),
      },
      {
        name: "DS-K1T341AM",
        description: "Access Control Terminal",
        serialNumber: "C20211105DDWR11223",
        imei: "112233445566778",
        iccid: "89000000000000000001",
        materialCode: "303201413",
        barcode: "6931847166560",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -12),
      },
      {
        name: "DS-3E0105P-E",
        description: "Network Switch",
        serialNumber: "C20220115FFWR55667",
        imei: "554433221100998",
        iccid: "89777777777777777773",
        materialCode: "303201414",
        barcode: "6931847166561",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 120),
      },
      {
        name: "DS-PWA96-M-WE",
        description: "Alarm Panel",
        serialNumber: "C20220228GGWR33445",
        imei: "123456789012345",
        iccid: "89123456789012345678",
        materialCode: "303201415",
        barcode: "6931847166562",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 60),
      },
      {
        name: "DS-2DE2A404IW-DE3",
        description: "PTZ Camera",
        serialNumber: "C20220310HHWR77889",
        imei: "987654321098765",
        iccid: "89987654321098765432",
        materialCode: "303201416",
        barcode: "6931847166563",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), -10),
      },
    ];

    for (const device of dummyDevices) {
      const batch = writeBatch(db);
      const newDevice = {
        ...device,
        ownerId: userId,
        planId: "standard-plan",
        lastUpdated: serverTimestamp(),
      };

      const docRef = doc(collection(db, "devices"));
      batch.set(docRef, newDevice);

      // Seed 14 days of usage stats for each device
      const usageCollection = collection(db, "devices", docRef.id, "usage");
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));

        const usageRef = doc(usageCollection);
        batch.set(usageRef, {
          timestamp: date,
          dataUsedMb: Math.floor(Math.random() * 450) + 50,
          activeHours: Math.floor(Math.random() * 12) + 2,
        });
      }
      await batch.commit();
    }
  },

  async deleteAllDevices(userId: string) {
    const q = query(collection(db, "devices"), where("ownerId", "==", userId));
    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      const batch = writeBatch(db);
      // Also delete usage subcollection for each device
      const usageQ = await getDocs(
        collection(db, "devices", docSnap.id, "usage"),
      );
      usageQ.docs.forEach((usageDoc) => {
        batch.delete(usageDoc.ref);
      });

      batch.delete(docSnap.ref);
      await batch.commit();
    }
  },
};
