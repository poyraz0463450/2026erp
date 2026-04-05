import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  assertDb,
  createAuditFields,
  stripUndefined,
  updateAuditFields,
} from "../utils/firestore";

export async function createDocument(collectionName, payload, userId, customId) {
  const db = assertDb();
  const documentRef = customId
    ? doc(db, collectionName, customId)
    : doc(collection(db, collectionName));

  await setDoc(
    documentRef,
    stripUndefined({
      ...payload,
      ...createAuditFields(userId),
    }),
  );

  return documentRef.id;
}

export async function updateDocumentById(collectionName, documentId, payload, userId) {
  const db = assertDb();
  const documentRef = doc(db, collectionName, documentId);

  await updateDoc(
    documentRef,
    stripUndefined({
      ...payload,
      ...updateAuditFields(userId),
    }),
  );
}

export async function deleteDocumentById(collectionName, documentId) {
  const db = assertDb();
  const documentRef = doc(db, collectionName, documentId);
  await deleteDoc(documentRef);
}

export async function getDocumentById(collectionName, documentId) {
  const db = assertDb();
  const documentRef = doc(db, collectionName, documentId);
  const snapshot = await getDoc(documentRef);

  if (!snapshot.exists()) {
    throw new Error(`${collectionName} kaydi bulunamadi.`);
  }

  return { id: snapshot.id, ...snapshot.data() };
}
