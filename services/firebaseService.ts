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
  updateDoc,
  limit
} from "firebase/firestore";
import { CorpsMemberEntry } from "../types";

export function initFirebase(config: any) {
  const app = initializeApp(config);
  return getFirestore(app);
}

export const subscribeToReports = (
  db: any,
  callback: (entries: CorpsMemberEntry[]) => void
) => {
  const q = query(
    collection(db, "nysc_reports"),
    orderBy("dateAdded", "desc"),
    limit(500)
  );

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as CorpsMemberEntry[];

    callback(entries);
  });
};

export const addReport = async (db: any, entry: any) => {
  return await addDoc(collection(db, "nysc_reports"), entry);
};

export const updateReport = async (db: any, id: string, entry: any) => {
  return await updateDoc(doc(db, "nysc_reports", id), entry);
};

export const deleteReport = async (db: any, id: string) => {
  return await deleteDoc(doc(db, "nysc_reports", id));
};
