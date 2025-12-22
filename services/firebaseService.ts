import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { CorpsMemberEntry } from "../types";

let app: any;

export function initFirebase(config: any) {
  if (!app) app = initializeApp(config);
  return getFirestore(app);
}

export const subscribeToReports = (
  db: any,
  callback: (data: CorpsMemberEntry[]) => void
) => {
  const q = query(
    collection(db, "nysc_reports"),
    orderBy("dateAdded", "desc")
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as CorpsMemberEntry[];
    callback(data);
  });
};

export const addReport = (db: any, data: any) =>
  addDoc(collection(db, "nysc_reports"), data);

export const updateReport = (db: any, id: string, data: any) =>
  updateDoc(doc(db, "nysc_reports", id), data);

export const deleteReport = (db: any, id: string) =>
  deleteDoc(doc(db, "nysc_reports", id));
