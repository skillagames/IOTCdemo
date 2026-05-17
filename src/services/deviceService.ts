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
  location?: string;
  ownerId: string;
  subscriptionStatus: "active" | "expired" | "inactive";
  activationDate?: any;
  expirationDate: any;
  planId: string;
  totalDataMb: number;
  remainingDataMb: number;
  lastUpdated: any;
  createdAt?: any;
  autoRenew?: boolean;
}

export const SUBSCRIPTION_PLANS = [
  {
    id: "topup",
    name: "Data Top Up",
    price: "R 249.00",
    dataMb: 180,
    days: 0,
    desc: "180MB Data • Top Up Only",
  },
  {
    id: "yearly",
    name: "Annual Renewal",
    price: "R 595.00",
    dataMb: 360,
    days: 365,
    desc: "360MB Data • 1 Year",
    badge: "Popular",
  },
];

export interface UsageStat {
  id: string;
  timestamp: any;
  dataUsedMb: number;
  activeHours: number;
}

export interface MasterRegistryEntry {
  id: string;
  serialNumber: string;
  imei: string;
  iccid: string;
  materialCode?: string;
  barcode?: string;
  model: string;
  description?: string;
  manufacturer?: string;
  location?: string;
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
    data: Partial<Device> & { ownerId: string; serialNumber: string; name: string }
  ) {
    const path = "devices";
    try {
      const now = new Date();
      // Apply requirement: 360MB data, 1 year plan, starts as inactive
      const totalDataMb = 360;
      const expirationDate = addDays(now, 365);

      const newDevice = {
        ...data,
        imei: data.imei || "N/A",
        iccid: data.iccid || "N/A",
        location: data.location || "",
        subscriptionStatus: "inactive",
        // activationDate is set when user clicks 'Activate'
        expirationDate: expirationDate,
        totalDataMb: totalDataMb,
        remainingDataMb: totalDataMb,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
        planId: data.planId || "yearly", // Fallback plan reference
      };
      const docRef = await addDoc(collection(db, path), newDevice);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async verifyHardware(input: string): Promise<MasterRegistryEntry | null> {
    if (!input) return null;
    const registryRef = collection(db, "master_registry");
    
    // 1. Initial clean
    let cleanInput = input.trim();
    if (!cleanInput) return null;

    // 2. Remove common Barcode symbology identifiers 
    // e.g., Code 128 often starts with ]C1, Datamatrix with ]d2
    // These are often hidden but can sometimes leak into the string depending on scanner config
    if (cleanInput.startsWith("]")) {
      cleanInput = cleanInput.replace(/^\][a-zA-Z0-9]{2}/, "");
    }

    const candidates = new Set<string>();
    
    const addCandidate = (val: string) => {
      const v = val.trim();
      if (!v || v.length < 3) return; // Ignore very short fragments
      candidates.add(v);
      candidates.add(v.toUpperCase());
      
      // For mostly-numeric strings (typical for IMEI/ICCID/Serial), 
      // try removing all separators (spaces, dots, hyphens)
      if (/^[\d\s\-\.a-zA-Z]+$/.test(v)) {
        const raw = v.replace(/[\s\-\.]/g, "");
        if (raw && raw.length >= 3 && raw !== v) {
          candidates.add(raw);
          candidates.add(raw.toUpperCase());
        }
        
        // Also try removing leading zeros which are common in some barcodes but not in DB
        if (/^0+\d+$/.test(v)) {
          const noLeadingZeros = v.replace(/^0+/, "");
          if (noLeadingZeros.length >= 3) {
            candidates.add(noLeadingZeros);
          }
        }
      }
    };

    addCandidate(cleanInput);
    
    // Split by common delimiters to find nested IDs in composite QR/Barcodes
    // Added more delimiters like / , : [ ] ( ) { } " ' < >
    const parts = cleanInput.split(/[\|;,\n\s\/\\:=\[\]\(\)\{\}"'<>]+/).map(p => p.trim()).filter(Boolean);
    parts.forEach(p => {
      addCandidate(p);
      
      // Handle labels merged with values, e.g., "SN12345" or "IMEI358..."
      const labelPrefixes = [
        "SN", "S/N", "SERIAL", "SER", "IMEI", "IMEI1", "IMEI2", 
        "IMEI_1", "ID", "MAT", "MODEL", "CODE", "MAC", "DATA", "VALUE"
      ];
      const upperP = p.toUpperCase();
      for (const prefix of labelPrefixes) {
        if (upperP.startsWith(prefix) && p.length > prefix.length) {
          // Check if there's a delimiter after prefix that might have been missed
          const possibleValue = p.substring(prefix.length).replace(/^[:=\-\s]+/, "");
          if (possibleValue) addCandidate(possibleValue);
        }
      }
    });

    const searchValues = Array.from(candidates);
    const fieldsToSearch = [
      "serialNumber",
      "imei",
      "materialCode",
      "barcode",
      "iccid",
      "model",
      "id" // Also allow searching by the master entry's own ID
    ];

    // Execute searches
    for (const field of fieldsToSearch) {
      // Best practice: search chunks to avoid too many values in 'in' clause
      for (let i = 0; i < searchValues.length; i += 10) {
        const chunk = searchValues.slice(i, i + 10);
        try {
          const q = query(registryRef, where(field, "in", chunk));
          const snap = await getDocs(q);
          if (!snap.empty) {
            return { id: snap.docs[0].id, ...snap.docs[0].data() } as MasterRegistryEntry;
          }
        } catch (err) {
          console.warn(`Search failed on field ${field} with chunk`, chunk, err);
        }
      }
    }

    return null;
  },

  async seedMasterRegistry() {
    // Only run if not already seeded in this session
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
        },
        {
          serialNumber: "Q44112434",
          imei: "358762109845777",
          iccid: "89014103211185109999",
          materialCode: "302401688",
          barcode: "6941264054313",
          model: "DS-PWA96-M-WE",
          description: "HIKVISION AX PRO",
          manufacturer: "Hikvision",
        }
      ];

      for (const deviceData of devices) {
        // Check for existence by ANY of the identifying fields
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
        "Master Registry Sync: Note - Only operators should provision global hardware keys.",
        e,
      );
    }
  },

  async renewSubscription(deviceId: string, planId: string) {
    const path = `devices/${deviceId}`;
    try {
      const deviceRef = doc(db, "devices", deviceId);
      const deviceSnap = await getDoc(deviceRef);
      if (!deviceSnap.exists()) return;
      
      const deviceData = deviceSnap.data() as Device;
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId) || SUBSCRIPTION_PLANS[0];
      
      const updatePayload: any = {
        subscriptionStatus: "active",
        totalDataMb: plan.id === "topup" ? (deviceData.totalDataMb || 0) + plan.dataMb : plan.dataMb,
        remainingDataMb: plan.id === "topup" ? (deviceData.remainingDataMb || 0) + plan.dataMb : plan.dataMb,
        planId: plan.id,
        lastUpdated: serverTimestamp(),
      };

      // Only update expiration if the plan has days attached (Renewal vs Top-up)
      if (plan.days > 0) {
        // If it's a first-time activation, always start from today. 
        // Otherwise, extend from whichever is later: current expiry or today.
        const isActivation = !deviceData.activationDate;
        const currentExp = deviceData.expirationDate?.toDate?.() || new Date();
        const baseDate = (isActivation || currentExp < new Date()) ? new Date() : currentExp;
        updatePayload.expirationDate = addDays(baseDate, plan.days);
      }

      // If activating an inactive device, set activationDate
      if (!deviceData.activationDate) {
        updatePayload.activationDate = new Date();
      }

      await updateDoc(deviceRef, updatePayload);
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
      // Realistic data consumption: roughly 3.3MB per day, split into chunks
      await addDoc(usageCollection, {
        timestamp: new Date(),
        dataUsedMb: parseFloat((Math.random() * 0.4 + 0.1).toFixed(2)),
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
        dataUsedMb: parseFloat((Math.random() * 2.5 + 1.5).toFixed(2)),
        activeHours: Math.floor(Math.random() * 8) + 4,
      });
    }
  },

  async seedDevices(userId: string) {
    const dummyDevices: Partial<Device>[] = [
      // 8 ACTIVE
      {
        name: "DS-7208HUHI-K2",
        description: "AcuSense DVR",
        location: "Main Entrance",
        serialNumber: "C20240901ZZWR00998",
        imei: "358762109845321",
        iccid: "89014103211185101234",
        subscriptionStatus: "active",
        activationDate: addDays(new Date(), -1),
        expirationDate: addDays(new Date(), 364),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
        createdAt: new Date(), // Mark as NEW
      },
      {
        name: "DS-KV8113-WME1",
        description: "Video Intercom",
        location: "Loading Bay 4",
        serialNumber: "C20211010CCWR54321",
        imei: "447788992233110",
        iccid: "89852033445566778899",
        subscriptionStatus: "active",
        activationDate: addDays(new Date(), -50),
        expirationDate: addDays(new Date(), 315),
        totalDataMb: 360,
        remainingDataMb: 285.2,
        planId: "yearly",
      },
      {
        name: "DS-2CD2347G2-LU",
        description: "ColorVu Turret",
        location: "Front Parking",
        serialNumber: "C20230820LLWR77665",
        imei: "860011223344600",
        iccid: "89000000000000000006",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 360),
        totalDataMb: 360,
        remainingDataMb: 345,
        planId: "yearly",
      },
      {
        name: "DS-2CD2T87G2-L",
        description: "ColorVu Bullet",
        location: "Perimeter North",
        serialNumber: "C20240101NNWR11223",
        imei: "860011223344601",
        iccid: "89000000000000000007",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 362),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      },
      {
        name: "DS-2CD2386G2-ISU",
        description: "AcuSense Turret",
        location: "Warehouse A",
        serialNumber: "C20240215OOWR22334",
        imei: "860011223344602",
        iccid: "89000000000000000008",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 340),
        totalDataMb: 360,
        remainingDataMb: 310,
        planId: "yearly",
      },
      {
        name: "DS-2CD2146G2-ISU",
        description: "AcuSense Dome",
        location: "Office Lobby",
        serialNumber: "C20240320PPWR33445",
        imei: "860011223344603",
        iccid: "89000000000000000009",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 355),
        totalDataMb: 360,
        remainingDataMb: 325,
        planId: "yearly",
      },
      {
        name: "DS-2CD2087G2-LU",
        description: "4K ColorVu Bullet",
        location: "Main Gate",
        serialNumber: "C20240410QQWR44556",
        imei: "860011223344604",
        iccid: "89000000000000000010",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 360),
        totalDataMb: 360,
        remainingDataMb: 358,
        planId: "yearly",
      },
      {
        name: "DS-2DE4425IW-DE",
        description: "Speed Dome PTZ",
        location: "Roof Top",
        serialNumber: "C20240505RRWR55667",
        imei: "860011223344605",
        iccid: "89000000000000000011",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 364),
        totalDataMb: 360,
        remainingDataMb: 350,
        planId: "yearly",
      },

      // 6 EXPIRED
      {
        name: "DS-7204HQHI-K1",
        description: "Digital Video Recorder",
        location: "Server Room",
        serialNumber: "C20210920BBWR98765",
        imei: "862341056789123",
        iccid: "89441012345678901234",
        subscriptionStatus: "expired",
        activationDate: addDays(new Date(), -400),
        expirationDate: addDays(new Date(), -35),
        totalDataMb: 360,
        remainingDataMb: 54.2,
        planId: "yearly",
      },
      {
        name: "DS-K1T341AM",
        description: "Access Terminal",
        location: "HR Office",
        serialNumber: "C20211105DDWR11223",
        imei: "112233445566778",
        iccid: "89000000000000000001",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), 200),
        totalDataMb: 180,
        remainingDataMb: 0,
        planId: "topup",
      },
      {
        name: "DS-2CD2143G0-IS",
        description: "Network Dome Camera",
        location: "Server Room Entrance",
        serialNumber: "C20220412HHWR11223",
        imei: "359988776655443",
        iccid: "89000000000000000002",
        subscriptionStatus: "expired",
        activationDate: addDays(new Date(), -500),
        expirationDate: addDays(new Date(), -10),
        totalDataMb: 180,
        remainingDataMb: 45.5,
        planId: "topup",
      },
      {
        name: "DS-2CD2047G2-L",
        description: "ColorVu Bullet",
        location: "East Wing",
        serialNumber: "C20220615EEWR11221",
        imei: "860011223344551",
        iccid: "89000000000000000012",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -5),
        totalDataMb: 360,
        remainingDataMb: 12,
        planId: "yearly",
      },
      {
        name: "DS-2CD2T47G2-L",
        description: "High-Res Bullet",
        location: "Rear Access",
        serialNumber: "C20220720FFWR22332",
        imei: "860011223344552",
        iccid: "89000000000000000013",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), 150),
        totalDataMb: 360,
        remainingDataMb: 0,
        planId: "yearly",
      },
      {
        name: "DS-2CD2343G0-I",
        description: "Fixed Turret",
        location: "Staff Canteen",
        serialNumber: "C20220825GGWR33443",
        imei: "860011223344553",
        iccid: "89000000000000000014",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), 100),
        totalDataMb: 360,
        remainingDataMb: 0,
        planId: "yearly",
      },

      // 4 INACTIVE
      {
        name: "DS-PWA96-M-WE",
        description: "Wireless Alarm Panel",
        location: "Boardroom",
        serialNumber: "C20220228GGWR33445",
        imei: "123456789012345",
        iccid: "89123456789012345678",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      },
      {
        name: "DS-2CD2185G0-IMS",
        description: "HDMI Dome Camera",
        location: "Meeting Room",
        serialNumber: "C20240601SSWR66771",
        imei: "860011223344606",
        iccid: "89000000000000000015",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      },
      {
        name: "DS-2CD2T86G2-IS",
        description: "AcuSense Bullet",
        location: "Side Parking",
        serialNumber: "C20240715TTWR77882",
        imei: "860011223344607",
        iccid: "89000000000000000016",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      },
      {
        name: "DS-2CD2347G2-L",
        description: "ColorVu Fixed Turret",
        location: "Gym Entrance",
        serialNumber: "C20240820UUWR88993",
        imei: "860011223344608",
        iccid: "89000000000000000017",
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      },
    ];

    // Shuffle to ensure a mixture of everything as requested
    const shuffledDevices = [...dummyDevices].sort(() => Math.random() - 0.5);

    for (const device of shuffledDevices) {
      const batch = writeBatch(db);
      const newDevice = {
        ...device,
        ownerId: userId,
        lastUpdated: serverTimestamp(),
        createdAt: device.createdAt || addDays(new Date(), -10),
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
          dataUsedMb: parseFloat((Math.random() * 2.5 + 1.5).toFixed(2)),
          activeHours: Math.floor(Math.random() * 8) + 4,
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
