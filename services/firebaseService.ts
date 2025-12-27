import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
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

export const initFirebase = (config: any): Firestore => {
  if (dbInstance) return dbInstance;
  
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(config) : apps[0];
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (error) {
    console.error("Firebase Initialization Failed:", error);
    throw error;
  }
};

const normalizeValue = (val: any): any => {
  if (!val) return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(normalizeValue);
  if (typeof val === 'object') {
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
  if (!database) {
    console.error("Database not provided for subscription:", collectionName);
    return () => {};
  }
  
  try {
    const q = query(collection(database, collectionName), orderBy("dateAdded", "desc"));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...normalizeValue(d.data()) 
      }));
      onUpdate(data);
    }, (error) => {
      console.error(`Snapshot error for ${collectionName}:`, error);
    });
  } catch (err) {
    console.error(`Failed to subscribe to ${collectionName}:`, err);
    return () => {};
  }
};

export const addData = async (database: Firestore, collectionName: string, data: any) => {
  if (!database) throw new Error("Database not initialized");
  return await addDoc(collection(database, collectionName), {
    ...data,
    dateAdded: new Date().toISOString(),
    _serverTimestamp: serverTimestamp()
  });
};

export const updateData = async (database: Firestore, collectionName: string, id: string, data: any) => {
  if (!database) throw new Error("Database not initialized");
  const ref = doc(database, collectionName, id);
  return await updateDoc(ref, { ...data, _lastModified: serverTimestamp() });
};

export const deleteData = async (database: Firestore, collectionName: string, id: string) => {
  if (!database) throw new Error("Database not initialized");
  return await deleteDoc(doc(database, collectionName, id));
};
