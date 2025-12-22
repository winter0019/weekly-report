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
} from "firebase/firestore";

export const initFirebase = (config: any) => {
  const app = initializeApp(config);
  return getFirestore(app);
};

export const subscribeToReports = (db: any, cb: any) => {
  const q = query(collection(db, "nysc_reports"), orderBy("dateAdded", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
};

export const addReport = (db: any, data: any) =>
  addDoc(collection(db, "nysc_reports"), data);

export const updateReport = (db: any, id: string, data: any) =>
  updateDoc(doc(db, "nysc_reports", id), data);

export const deleteReport = (db: any, id: string) =>
  deleteDoc(doc(db, "nysc_reports", id));
