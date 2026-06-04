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
  manufacturer?: string;
}

export function getManufacturerLogo(manufacturer?: string): string {
  const m = (manufacturer || "HIKVISION").trim().toUpperCase();
  if (m.includes("JIMI")) {
    return "/Jimi-Iot-logo-1.png";
  }
  if (m === "BS") {
    return "/Bslogo.png";
  }
  if (m.includes("DAHUA")) {
    return "/Dahua_logo.png";
  }
  return "/hikvision.svg";
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

export interface SeedConfig {
  activeCount: number;
  expiredCount: number;
  inactiveCount: number;
  newDevicesCount: number;
}

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

let isMasterRegistrySeedingActive = false;
let isMasterRegistrySeededThisSession = false;

export const MASTER_DEVICES = [
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
  },
  {
    serialNumber: "CK2144765",
    imei: "867806072755749",
    barcode: "6975248490460",
    materialCode: "307900723",
    model: "AE-DI5052-G40 PRO",
    description: "DashCam",
    manufacturer: "Hikvision",
  },
  {
    serialNumber: "869247060300081",
    imei: "869247060300081",
    model: "Jimi IoT 4G Al DashCam",
    description: "Jimi IoT 4G Al DashCam",
    manufacturer: "JimiIoT",
  },
  {
    serialNumber: "BF00278PAJ00001",
    imei: "865622075263116",
    iccid: "89014103211185002781",
    model: "DHI-ARC3800H-FW2(868)",
    description: "DAHUA Alarm Hub",
    manufacturer: "DAHUA VISION TECHNOLOGY",
  }
];

export const deviceService = {
  async getUserDevices(userId: string) {
    const path = "devices";
    try {
      const q = query(collection(db, path), where("ownerId", "==", userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) => ({
          id: doc.id,
          manufacturer: "HIKVISION",
          ...doc.data(),
        } as Device),
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
        return {
          id: docSnap.id,
          manufacturer: "HIKVISION",
          ...docSnap.data(),
        } as Device;
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
        manufacturer: "HIKVISION",
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

      // Requirement: Start with 0 values for analytics so charts show up but are empty
      const usageCollection = collection(db, "devices", docRef.id, "usage");
      const batch = writeBatch(db);
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        const usageRef = doc(usageCollection);
        batch.set(usageRef, {
          timestamp: date,
          dataUsedMb: 0,
          activeHours: 0,
        });
      }
      await batch.commit();

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  async verifyHardware(input: string): Promise<MasterRegistryEntry | null> {
    if (!input) return null;
    
    // Proactively ensure database handles manual device sync/seeding if not done in session
    await this.seedMasterRegistry();

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
          
          // Fallback to local in-memory search if Firestore collection could not be reached (offline/network issues)
          const matchedLocal = MASTER_DEVICES.find(dev => {
            const val = (dev as any)[field];
            return val && chunk.includes(val);
          });
          if (matchedLocal) {
            console.log("Offline Fallback: Recognized device in local master memory registry", matchedLocal);
            return { id: `local_${matchedLocal.serialNumber}`, ...matchedLocal } as MasterRegistryEntry;
          }
        }
      }
    }

    // Absolute Fallback: Search the entire local MASTER_DEVICES array using the accumulated search candidates.
    // This handles cases where queries complete successfully but the database collection is empty or rules block it silently.
    const searchValuesLower = searchValues.map(v => v.toLowerCase().trim());
    const matchedLocal = MASTER_DEVICES.find(dev => {
      return [
        dev.serialNumber,
        dev.imei,
        dev.iccid,
        (dev as any).materialCode,
        (dev as any).barcode,
        dev.model
      ].some(fieldVal => fieldVal && searchValuesLower.includes(fieldVal.toLowerCase().trim()));
    });

    if (matchedLocal) {
      console.log("Ultimate Fallback: Recognized device inside master local registry memory:", matchedLocal.serialNumber);
      return { id: `local_${matchedLocal.serialNumber}`, ...matchedLocal } as MasterRegistryEntry;
    }

    return null;
  },

  async seedMasterRegistry() {
    // Only run if not already seeded in this browser tab/session memory
    if (isMasterRegistrySeededThisSession || isMasterRegistrySeedingActive) return;

    // Check sessionStorage as well to avoid redundant database calls if we've completed a session-wide seed successful write
    const isSeededInSession = sessionStorage.getItem("master_registry_seeded_v16");
    if (isSeededInSession === "true") {
      isMasterRegistrySeededThisSession = true;
      return;
    }

    try {
      isMasterRegistrySeedingActive = true;
      const registryRef = collection(db, "master_registry");
      const devices = MASTER_DEVICES;

      for (const deviceData of devices) {
        // Check for existence by ANY of the identifying fields, specifically serialNumber
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
          console.log(`Seeded device ${deviceData.serialNumber} into master registry.`);
        } else {
          // Update details if it already exists to keep name current
          const docId = snapshot.docs[0].id;
          await updateDoc(doc(db, "master_registry", docId), {
            description: deviceData.description || null,
            model: deviceData.model,
            manufacturer: deviceData.manufacturer,
            lastSeeded: serverTimestamp(),
          });
        }
      }

      // Also proactively update any existing registered user devices in the "devices" collection with this IMEI or Serial Number
      try {
        const devicesRef = collection(db, "devices");
        
        // Migrate Jimi
        const jimiQueries = [
          query(devicesRef, where("serialNumber", "==", "869247060300081")),
          query(devicesRef, where("imei", "==", "869247060300081"))
        ];
        for (const dq of jimiQueries) {
          const dSnap = await getDocs(dq);
          for (const docSnap of dSnap.docs) {
            await updateDoc(doc(db, "devices", docSnap.id), {
              name: "Jimi IoT 4G Al DashCam",
              description: "Jimi IoT 4G Al DashCam",
              manufacturer: "JimiIoT",
              lastUpdated: serverTimestamp()
            });
          }
        }

        // Migrate Dahua
        const dahuaQueries = [
          query(devicesRef, where("serialNumber", "==", "BF00278PAJ00001")),
          query(devicesRef, where("serialNumber", "==", "BF0O278PAJ00001")),
          query(devicesRef, where("imei", "==", "865622075263116"))
        ];
        for (const dq of dahuaQueries) {
          const dSnap = await getDocs(dq);
          for (const docSnap of dSnap.docs) {
            await updateDoc(doc(db, "devices", docSnap.id), {
              description: "DAHUA Alarm Hub",
              model: "DHI-ARC3800H-FW2(868)",
              manufacturer: "DAHUA VISION TECHNOLOGY",
              lastUpdated: serverTimestamp()
            });
          }
        }
      } catch (devMigrateError) {
        console.warn("Could not migrate registered devices on seeding:", devMigrateError);
      }

      sessionStorage.setItem("master_registry_seeded_force_v10", "true");
      sessionStorage.setItem("master_registry_seeded_v16", "true");
      isMasterRegistrySeededThisSession = true;
      console.log("Master database registry seeded successfully!");
    } catch (e) {
      console.warn(
        "Master Registry Sync: Note - Only operators should provision global hardware keys.",
        e,
      );
    } finally {
      isMasterRegistrySeedingActive = false;
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

  async seedDevices(userId: string, config: SeedConfig = { activeCount: 2, expiredCount: 6, inactiveCount: 4, newDevicesCount: 1 }) {
    const devicesToSeed: (Partial<Device> & { isNew?: boolean })[] = [];
    
    const deviceModels = [
      { name: "DS-7208HUHI-K2", desc: "AcuSense DVR" },
      { name: "DS-KV8113-WME1", desc: "Video Intercom" },
      { name: "DS-7204HQHI-K1", desc: "Digital Video Recorder" },
      { name: "DS-K1T341AM", desc: "Access Terminal" },
      { name: "DS-2CD2143G0-IS", desc: "Network Dome Camera" },
      { name: "DS-2CD2047G2-L", desc: "ColorVu Bullet" },
      { name: "DS-2CD2T47G2-L", desc: "High-Res Bullet" },
      { name: "DS-2CD2343G0-I", desc: "Fixed Turret" },
      { name: "DS-PWA96-M-WE", desc: "Wireless Alarm Panel" },
      { name: "DS-2CD2185G0-IMS", desc: "HDMI Dome Camera" },
      { name: "DS-2CD2T86G2-IS", desc: "AcuSense Bullet" },
      { name: "DS-2CD2347G2-L", desc: "ColorVu Fixed Turret" },
    ];

    const locations = ["Main Entrance", "Loading Bay 4", "Server Room", "HR Office", "East Wing", "Rear Access", "Staff Canteen", "Boardroom", "Meeting Room", "Side Parking", "Gym Entrance", "Front Parking", "Office Lobby", "Warehouse A"];

    // 1. New Devices (Active, 0 usage)
    for (let i = 0; i < config.newDevicesCount; i++) {
      const model = deviceModels[i % deviceModels.length];
      devicesToSeed.push({
        name: model.name,
        description: model.desc,
        location: locations[Math.floor(Math.random() * locations.length)],
        serialNumber: `C2024${Math.floor(Math.random() * 9000 + 1000)}ZZWR${Math.floor(Math.random() * 90000 + 10000)}`,
        imei: `35876210${Math.floor(Math.random() * 9000000 + 1000000)}`,
        iccid: `89014103211185${Math.floor(Math.random() * 900000 + 100000)}`,
        subscriptionStatus: "active",
        activationDate: new Date(),
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
        createdAt: new Date(),
        isNew: true as any, // Temporary marker for seeding usage
      });
    }

    // 2. Remaining Active Devices (Regular usage)
    const remainingActive = Math.max(0, config.activeCount - config.newDevicesCount);
    for (let i = 0; i < remainingActive; i++) {
      const model = deviceModels[(config.newDevicesCount + i) % deviceModels.length];
      devicesToSeed.push({
        name: model.name,
        description: model.desc,
        location: locations[Math.floor(Math.random() * locations.length)],
        serialNumber: `C2023${Math.floor(Math.random() * 9000 + 1000)}AAWR${Math.floor(Math.random() * 90000 + 10000)}`,
        imei: `86234105${Math.floor(Math.random() * 9000000 + 1000000)}`,
        iccid: `8944101234${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        subscriptionStatus: "active",
        activationDate: addDays(new Date(), -Math.floor(Math.random() * 100)),
        expirationDate: addDays(new Date(), Math.floor(Math.random() * 300) + 30),
        totalDataMb: 360,
        remainingDataMb: parseFloat((Math.random() * 300 + 50).toFixed(1)),
        planId: "yearly",
      });
    }

    // 3. Expired Devices (Half plan, half data)
    for (let i = 0; i < config.expiredCount; i++) {
      const model = deviceModels[(config.activeCount + i) % deviceModels.length];
      const isDataExpired = i < Math.ceil(config.expiredCount / 2);
      
      devicesToSeed.push({
        name: model.name,
        description: model.desc,
        location: locations[Math.floor(Math.random() * locations.length)],
        serialNumber: `C2022${Math.floor(Math.random() * 9000 + 1000)}EXWR${Math.floor(Math.random() * 90000 + 10000)}`,
        imei: `11223344${Math.floor(Math.random() * 9000000 + 1000000)}`,
        iccid: `8900000000${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        subscriptionStatus: "expired",
        activationDate: addDays(new Date(), -400),
        expirationDate: isDataExpired ? addDays(new Date(), 100) : addDays(new Date(), -Math.floor(Math.random() * 30 + 1)),
        totalDataMb: isDataExpired ? 180 : 360,
        remainingDataMb: isDataExpired ? 0 : parseFloat((Math.random() * 20).toFixed(1)),
        planId: isDataExpired ? "topup" : "yearly",
      });
    }

    // 4. Inactive Devices
    for (let i = 0; i < config.inactiveCount; i++) {
      const model = deviceModels[(config.activeCount + config.expiredCount + i) % deviceModels.length];
      devicesToSeed.push({
        name: model.name,
        description: model.desc,
        location: locations[Math.floor(Math.random() * locations.length)],
        serialNumber: `C2024${Math.floor(Math.random() * 9000 + 1000)}INWR${Math.floor(Math.random() * 90000 + 10000)}`,
        imei: `12345678${Math.floor(Math.random() * 9000000 + 1000000)}`,
        iccid: `89123456${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        subscriptionStatus: "inactive",
        expirationDate: addDays(new Date(), 365),
        totalDataMb: 360,
        remainingDataMb: 360,
        planId: "yearly",
      });
    }

    // Shuffle and Batch Write
    const shuffledDevices = [...devicesToSeed].sort(() => Math.random() - 0.5);

    for (const device of shuffledDevices) {
      const batch = writeBatch(db);
      const isNew = (device as any).isNew;
      delete (device as any).isNew; // Cleanup temporary marker

      const newDevice = {
        manufacturer: "HIKVISION",
        ...device,
        ownerId: userId,
        lastUpdated: serverTimestamp(),
        createdAt: device.createdAt || addDays(new Date(), -Math.floor(Math.random() * 20 + 5)),
      };

      const docRef = doc(collection(db, "devices"));
      batch.set(docRef, newDevice);

      // Seed 14 days of usage stats
      const usageCollection = collection(db, "devices", docRef.id, "usage");
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));

        const usageRef = doc(usageCollection);
        batch.set(usageRef, {
          timestamp: date,
          dataUsedMb: isNew ? 0 : parseFloat((Math.random() * 2.5 + 1.5).toFixed(2)),
          activeHours: isNew ? 0 : Math.floor(Math.random() * 8) + 4,
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
