import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
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
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

let dbInstance: Firestore | null = null;

/**
 * Initializes Firebase and Firestore.
 * Using a singleton pattern to ensure only one instance is active.
 */
export const initFirebase = (config: any): Firestore => {
  try {
    let app: FirebaseApp;
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    if (!dbInstance) {
      dbInstance = getFirestore(app);
    }
    return dbInstance;
  } catch (error) {
    console.error("CRITICAL: Error initializing Firebase/Firestore:", error);
    throw error;
  }
};

/**
 * Normalizes Firestore data into a plain JSON-serializable format.
 */
const normalizeValue = (value: any): any => {
  if (value === null || value === undefined) return "";
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value.toDate === 'function') {
    try { return value.toDate().toISOString(); } catch (e) {}
  }
  if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object' && value.constructor === Object) {
    const normalized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        normalized[key] = normalizeValue(value[key]);
      }
    }
    return normalized;
  }
  return String(value);
};

export const subscribeToReports = (
  database: Firestore, 
  onUpdate: (data: any[]) => void, 
  onError?: (err: any) => void
) => {
  if (!database) {
    console.warn("subscribeToReports: Firestore instance not provided.");
    return () => {};
  }
  
  try {
    const q = query(collection(database, "nysc_reports"), orderBy("dateAdded", "desc"));
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnapshot => {
        const normalizedData = normalizeValue(docSnapshot.data());
        return { id: docSnapshot.id, ...normalizedData };
      });
      onUpdate(data);
    }, (error) => {
      console.error("Firestore subscription failure:", error);
      if (onError) onError(error);
    });
  } catch (error) {
    console.error("Error setting up Firestore snapshot listener:", error);
    return () => {};
  }
};

export const addReport = async (database: Firestore, entry: any) => {
  if (!database) throw new Error("Firestore instance required for addReport");
  const reportData = {
    ...entry,
    dateAdded: entry.dateAdded || new Date().toISOString(),
    _serverTimestamp: serverTimestamp() 
  };
  return await addDoc(collection(database, "nysc_reports"), reportData);
};

export const updateReport = async (database: Firestore, id: string, entry: any) => {
  if (!database) throw new Error("Firestore instance required for updateReport");
  const reportRef = doc(database, "nysc_reports", id);
  return await updateDoc(reportRef, {
    ...entry,
    _lastModified: serverTimestamp()
  });
};

export const deleteReport = async (database: Firestore, id: string) => {
  if (!database) throw new Error("Firestore instance required for deleteReport");
  return await deleteDoc(doc(database, "nysc_reports", id));
};