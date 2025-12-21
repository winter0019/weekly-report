
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc,
  limit
} from "firebase/firestore";
import { CorpsMemberEntry } from "../types";

export function initFirebase(config: any) {
  const app = initializeApp(config);
  const db = getFirestore(app);
  return db;
}

// Added errorCallback parameter to handle subscription errors and match usage in App.tsx
export const subscribeToReports = (db: any, callback: (entries: CorpsMemberEntry[]) => void, errorCallback?: (error: any) => void) => {
  const q = query(collection(db, "nysc_reports"), orderBy("dateAdded", "desc"), limit(500));
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CorpsMemberEntry[];
    callback(entries);
  }, (error) => {
    console.error("Firestore Error:", error);
    if (errorCallback) {
      errorCallback(error);
    }
  });
};

export const addReport = async (db: any, entry: any) => {
  return await addDoc(collection(db, "nysc_reports"), entry);
};

export const deleteReport = async (db: any, id: string) => {
  return await deleteDoc(doc(db, "nysc_reports", id));
}
