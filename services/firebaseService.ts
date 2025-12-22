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
  limit,
} from "firebase/firestore";
import { CorpsMemberEntry } from "../types";

let appInitialized = false;

export function initFirebase(config: any) {
  if (!appInitialized) {
    initializeApp(config);
    appInitialized = true;
  }
  return getFirestore();
}

export const subscribeToReports = (
  db: any,
  callback: (entries: CorpsMemberEntry[]) => void,
  errorCallback?: (error: any) => void
) => {
  const q = query(
    collection(db, "nysc_reports"),
    orderBy("dateAdded", "desc"),
    limit(500)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as CorpsMemberEntry[];

      callback(entries);
    },
    (error) => {
      console.error("Firestore subscription error:", error);
      errorCallback?.(error);
    }
  );
};

export const addReport = async (db: any, entry: any) => {
  return await addDoc(collection(db, "nysc_reports"), entry);
};

export const deleteReport = async (db: any, id: string) => {
  return await deleteDoc(doc(db, "nysc_reports", id));
};
