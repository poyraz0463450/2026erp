import { addDoc, collection } from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import { assertDb, createAuditFields, stripUndefined } from "../utils/firestore";

export async function logAction({
  userId,
  action,
  entityType,
  entityId,
  details,
}) {
  const db = assertDb();

  await addDoc(
    collection(db, COLLECTIONS.LOGS),
    stripUndefined({
      user_id: userId || "system",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {},
      ...createAuditFields(userId),
    }),
  );
}
