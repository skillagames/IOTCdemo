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
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { addDays } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/utils';

export interface Device {
  id: string;
  serialNumber: string;
  imei: string;
  iccid: string;
  name: string;
  ownerId: string;
  subscriptionStatus: 'active' | 'expired' | 'inactive';
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
    const path = 'devices';
    try {
      const q = query(collection(db, path), where('ownerId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async getDeviceById(deviceId: string) {
    const path = `devices/${deviceId}`;
    try {
      const docRef = doc(db, 'devices', deviceId);
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

  async registerDevice(data: Omit<Device, 'id' | 'subscriptionStatus' | 'expirationDate' | 'lastUpdated'>) {
    const path = 'devices';
    try {
      const newDevice = {
        ...data,
        imei: (data as any).imei || 'N/A',
        iccid: (data as any).iccid || 'N/A',
        subscriptionStatus: 'inactive', // New devices start as not active
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

  async verifyHardware(serialNumber: string) {
    const q = query(collection(db, 'master_registry'), where('serialNumber', '==', serialNumber));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    return querySnapshot.docs[0].data();
  },

  async seedMasterRegistry() {
    try {
      const registryRef = collection(db, 'master_registry');
      const q = query(registryRef, where('serialNumber', '==', '6001237010828'));
      const snapshot = await getDocs(q);
      
      const masterData = {
        serialNumber: '6001237010828',
        imei: '358762109845321',
        iccid: '89014103211185101234',
        model: 'IoT-Hub-X1',
        manufacturer: 'IoTConnect Labs',
        lastSeeded: serverTimestamp()
      };

      if (snapshot.empty) {
        await addDoc(registryRef, {
          ...masterData,
          createdAt: serverTimestamp()
        });
        console.log("Master Registry: New test device provisioned.");
      } else {
        // Force update existing record to ensure it has all fields
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, 'master_registry', docId), masterData);
        console.log("Master Registry: Test device updated with latest descriptors.");
      }
    } catch (e) {
      console.warn("Master Registry Sync: Only operators can provision global hardware keys.", e);
    }
  },

  async renewSubscription(deviceId: string, days: number = 30) {
    const path = `devices/${deviceId}`;
    try {
      const deviceRef = doc(db, 'devices', deviceId);
      await updateDoc(deviceRef, {
        subscriptionStatus: 'active',
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
        collection(db, 'devices', deviceId, 'usage'),
        orderBy('timestamp', 'desc'),
        limit(30)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Convert Firestore Timestamp to millis for better chart sorting/rendering
        const timestamp = data.timestamp?.toMillis?.() || 
                         (data.timestamp?.seconds ? data.timestamp.seconds * 1000 : Date.now());
        
        return { 
          id: doc.id, 
          ...data, 
          timestamp 
        } as UsageStat;
      }).reverse();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async toggleAutoRenew(deviceId: string, enabled: boolean) {
    const path = `devices/${deviceId}`;
    try {
      const deviceRef = doc(db, 'devices', deviceId);
      await updateDoc(deviceRef, {
        autoRenew: enabled,
        lastUpdated: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getAllDevices() {
    const path = 'devices';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  },

  async syncTelemetry(deviceId: string) {
    const path = `devices/${deviceId}/usage`;
    try {
      const usageCollection = collection(db, 'devices', deviceId, 'usage');
      await addDoc(usageCollection, {
        timestamp: new Date(),
        dataUsedMb: Math.floor(Math.random() * 50) + 10,
        activeHours: 1
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
      const usageQ = await getDocs(collection(db, 'devices', deviceId, 'usage'));
      usageQ.docs.forEach(usageDoc => {
        batch.delete(usageDoc.ref);
      });
      
      // Delete the device itself
      batch.delete(doc(db, 'devices', deviceId));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async seedDeviceUsage(deviceId: string) {
    const usageCollection = collection(db, 'devices', deviceId, 'usage');
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      
      await addDoc(usageCollection, {
        timestamp: date,
        dataUsedMb: Math.floor(Math.random() * 450) + 50,
        activeHours: Math.floor(Math.random() * 12) + 2
      });
    }
  },

  async seedDevices(userId: string) {
    const dummyDevices = [
      {
        name: "Pro Route X1",
        serialNumber: "SN-98234-X1",
        imei: "358762109845321",
        iccid: "89014103211185101234",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 15),
      },
      {
        name: "Compact Terminal V2",
        serialNumber: "SN-12093-V2",
        imei: "862341056789123",
        iccid: "89441012345678901234",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -5),
      },
      {
        name: "Enterprise Hub G5",
        serialNumber: "SN-55667-G5",
        imei: "447788992233110",
        iccid: "89852033445566778899",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 45),
      },
      {
        name: "Field Monitor M1",
        serialNumber: "SN-00231-M1",
        imei: "112233445566778",
        iccid: "89000000000000000001",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -12),
      },
      {
        name: "Remote Sensor A9",
        serialNumber: "SN-44321-A9",
        imei: "998877665544332",
        iccid: "89999999999999999992",
        subscriptionStatus: "expired",
        expirationDate: addDays(new Date(), -30),
      },
      {
        name: "Gateway Core Z5",
        serialNumber: "SN-77889-Z5",
        imei: "554433221100998",
        iccid: "89777777777777777773",
        subscriptionStatus: "active",
        expirationDate: addDays(new Date(), 120),
      }
    ];

    for (const device of dummyDevices) {
      const newDevice = {
        ...device,
        ownerId: userId,
        planId: "standard-plan",
        lastUpdated: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'devices'), newDevice);
      
      // Seed 14 days of usage stats for each device
      const usageCollection = collection(db, 'devices', docRef.id, 'usage');
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (13 - i));
        
        await addDoc(usageCollection, {
          timestamp: date,
          dataUsedMb: Math.floor(Math.random() * 450) + 50,
          activeHours: Math.floor(Math.random() * 12) + 2
        });
      }
    }
  },

  async deleteAllDevices(userId: string) {
    const q = query(collection(db, 'devices'), where('ownerId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    
    for (const docSnap of querySnapshot.docs) {
      // Also delete usage subcollection for each device
      const usageQ = await getDocs(collection(db, 'devices', docSnap.id, 'usage'));
      usageQ.docs.forEach(usageDoc => {
        batch.delete(usageDoc.ref);
      });
      
      batch.delete(docSnap.ref);
    }
    
    await batch.commit();
  }
};
