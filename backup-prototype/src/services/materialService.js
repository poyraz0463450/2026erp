import { collection, getDocs, query, where } from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import { assertDb } from "../utils/firestore";

export async function getBomItemsByModel(modelId) {
  const database = assertDb();
  const bomQuery = query(
    collection(database, COLLECTIONS.BOM_ITEMS),
    where("model_id", "==", modelId),
  );

  const snapshot = await getDocs(bomQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}
