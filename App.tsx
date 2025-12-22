import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
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

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as CorpsMemberEntry[];
    callback(data);
  });
};

export const addReport = async (db: any, data: any) => {
  return addDoc(collection(db, "nysc_reports"), data);
};

export const updateReport = async (db: any, id: string, data: any) => {
  return updateDoc(doc(db, "nysc_reports", id), data);
};

export const deleteReport = async (db: any, id: string) => {
  return deleteDoc(doc(db, "nysc_reports", id));
};
