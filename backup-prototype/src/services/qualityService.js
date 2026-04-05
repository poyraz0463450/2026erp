import { doc, getDoc, updateDoc } from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import { assertDb, updateAuditFields } from "../utils/firestore";
import { createDocument } from "./baseService";
import {
  applyIncomingQcDecision,
  updateGoodsReceiptQcStatus,
} from "./inventoryService";
import { logAction } from "./logService";

export async function createQualityPlan(values, userId) {
  const planId = await createDocument(COLLECTIONS.QUALITY_PLANS, values, userId);
  await logAction({
    userId,
    action: "quality_plans.create",
    entityType: COLLECTIONS.QUALITY_PLANS,
    entityId: planId,
    details: values,
  });
  return planId;
}

export async function createQualityRecord(values, userId) {
  const recordId = await createDocument(COLLECTIONS.QUALITY_RECORDS, values, userId);

  if (values.inspection_type === "incoming" && values.goods_receipt_id) {
    const db = assertDb();
    const goodsReceiptRef = doc(db, COLLECTIONS.GOODS_RECEIPTS, values.goods_receipt_id);
    const goodsReceiptSnapshot = await getDoc(goodsReceiptRef);

    if (!goodsReceiptSnapshot.exists()) {
      throw new Error("Mal kabul kaydi bulunamadi.");
    }

    const goodsReceipt = goodsReceiptSnapshot.data();

    if (values.result !== "conditional") {
      await applyIncomingQcDecision({
        itemId: goodsReceipt.part_id,
        lotNumber: goodsReceipt.lot_number,
        warehouseId: goodsReceipt.warehouse_id,
        locationId: goodsReceipt.location_id,
        quantity: goodsReceipt.received_quantity,
        result: values.result,
        qualityRecordId: recordId,
        userId,
      });
    }

    await updateGoodsReceiptQcStatus(values.goods_receipt_id, values.result, userId);
  }

  await logAction({
    userId,
    action: "quality_records.create",
    entityType: COLLECTIONS.QUALITY_RECORDS,
    entityId: recordId,
    details: values,
  });

  return recordId;
}

export async function createNonconformity(values, userId) {
  const nonconformityId = await createDocument(COLLECTIONS.NONCONFORMITIES, values, userId);
  await logAction({
    userId,
    action: "nonconformities.create",
    entityType: COLLECTIONS.NONCONFORMITIES,
    entityId: nonconformityId,
    details: values,
  });
  return nonconformityId;
}

export async function linkNonconformity(recordId, nonconformityId, userId) {
  const db = assertDb();
  await updateDoc(doc(db, COLLECTIONS.QUALITY_RECORDS, recordId), {
    nonconformity_id: nonconformityId,
    ...updateAuditFields(userId),
  });
}
