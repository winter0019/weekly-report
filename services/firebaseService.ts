import { initializeApp, getApps, FirebaseApp, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
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
      // Modern way to enable persistence using FirestoreSettings.cache to avoid deprecation warnings
      dbInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
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
      console.warn(`Subscription error (${collectionName}):`, error.message);
    });
  } catch (err) {
    console.error(`Listener failed for ${collectionName}:`, err);
    return () => {};
  }
};

export const addData = async (database: Firestore | null, collectionName: string, data: any) => {
  if (!database) throw new Error("Database offline.");
  const cleanData = sanitizeData(data);
  return await addDoc(collection(database, collectionName), {
    ...cleanData,
    dateAdded: new Date().toISOString(),
    _serverTimestamp: serverTimestamp()
  });
};

export const updateData = async (database: Firestore | null, collectionName: string, id: string, data: any) => {
  if (!database) throw new Error("Database offline.");
  const ref = doc(database, collectionName, id);
  const cleanData = sanitizeData(data);
  return await updateDoc(ref, { ...cleanData, _lastModified: serverTimestamp() });
};

export const deleteData = async (database: Firestore | null, collectionName: string, id: string) => {
  if (!database) throw new Error("Database offline.");
  return await deleteDoc(doc(database, collectionName, id));
};