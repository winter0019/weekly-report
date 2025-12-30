import { initializeApp, getApps, FirebaseApp, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  enableIndexedDbPersistence,
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  doc,
  Firestore,
  serverTimestamp
} from "firebase/firestore";

let dbInstance: Firestore | null = null;

const sanitizeData = (data: any): any => {
  return JSON.parse(JSON.stringify(data));
};

export const initFirebase = (config: any): Firestore => {
  try {
    let app: FirebaseApp;
    const apps = getApps();
    
    if (apps.length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    
    if (!dbInstance) {
      // Use initializeFirestore with experimentalForceLongPolling to bypass WebSocket blocking issues
      // which is the common cause for the 10s timeout error.
      dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });

      // Enable offline persistence for better resilience
      enableIndexedDbPersistence(dbInstance).catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
          console.warn("Firestore Persistence: Failed precondition (multiple tabs).");
        } else if (err.code === 'unimplemented') {
          // The current browser doesn't support all of the features needed to enable persistence
          console.warn("Firestore Persistence: Unimplemented in this browser.");
        }
      });
    }
    
    return dbInstance;
  } catch (error) {
    console.error("Critical Firebase Initialization Error:", error);
    throw error;
  }
};

const normalizeValue = (val: any): any => {
  if (val === null || val === undefined) return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(normalizeValue);
  if (typeof val === 'object' && !(val instanceof Date)) {
    const res: any = {};
    for (const k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        res[k] = normalizeValue(val[k]);
      }
    }
    return res;
  }
  return val;
};

export const subscribeToCollection = (
  database: Firestore, 
  collectionName: string,
  onUpdate: (data: any[]) => void
) => {
  if (!database) return () => {};
  
  try {
    const q = query(collection(database, collectionName), orderBy("dateAdded", "desc"));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...normalizeValue(d.data()) 
      }));
      onUpdate(data);
    }, (error) => {
      // Log but don't crash, Firestore will automatically retry
      console.error(`Subscription error (${collectionName}):`, error);
    });
  } catch (err) {
    console.error(`Failed to setup listener for ${collectionName}:`, err);
    return () => {};
  }
};

export const addData = async (database: Firestore | null, collectionName: string, data: any) => {
  if (!database) throw new Error("Database service is offline.");
  const cleanData = sanitizeData(data);
  return await addDoc(collection(database, collectionName), {
    ...cleanData,
    dateAdded: new Date().toISOString(),
    _serverTimestamp: serverTimestamp()
  });
};

export const updateData = async (database: Firestore | null, collectionName: string, id: string, data: any) => {
  if (!database) throw new Error("Database service is offline.");
  const ref = doc(database, collectionName, id);
  const cleanData = sanitizeData(data);
  return await updateDoc(ref, { ...cleanData, _lastModified: serverTimestamp() });
};

export const deleteData = async (database: Firestore | null, collectionName: string, id: string) => {
  if (!database) throw new Error("Database service is offline.");
  return await deleteDoc(doc(database, collectionName, id));
};