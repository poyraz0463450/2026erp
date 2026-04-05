import { doc, getDoc, updateDoc } from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import { assertDb, toNumber, updateAuditFields } from "../utils/firestore";
import { createDocument } from "./baseService";
import { consumeInventory, manualInventoryEntry } from "./inventoryService";
import { logAction } from "./logService";
import { getBomItemsByModel } from "./materialService";

export async function createProductionOrder(values, userId) {
  const bomSnapshot = await getBomItemsByModel(values.model_id);
  const scaledBom = bomSnapshot.map((item) => ({
    part_id: item.part_id,
    quantity_per: toNumber(item.quantity),
    required_quantity: toNumber(item.quantity) * toNumber(values.quantity),
  }));

  const orderId = await createDocument(
    COLLECTIONS.PRODUCTION_ORDERS,
    {
      model_id: values.model_id,
      quantity: toNumber(values.quantity),
      planned_date: values.planned_date,
      status: values.status || "pending",
      bom_snapshot: scaledBom,
      good_quantity: 0,
      scrap_quantity: 0,
    },
    userId,
  );

  await logAction({
    userId,
    action: "production_orders.create",
    entityType: COLLECTIONS.PRODUCTION_ORDERS,
    entityId: orderId,
    details: values,
  });

  return orderId;
}

export async function createProductionLog(values, userId) {
  const db = assertDb();
  const productionOrderRef = doc(db, COLLECTIONS.PRODUCTION_ORDERS, values.production_order_id);
  const productionOrderSnapshot = await getDoc(productionOrderRef);

  if (!productionOrderSnapshot.exists()) {
    throw new Error("Uretim emri bulunamadi.");
  }

  const productionOrder = productionOrderSnapshot.data();

  if (values.log_type === "start") {
    const allocations = Array.isArray(values.material_allocations)
      ? values.material_allocations
      : [];

    for (const allocation of allocations) {
      await consumeInventory({
        itemType: "part",
        itemId: allocation.part_id,
        lotNumber: allocation.lot_number,
        warehouseId: allocation.warehouse_id,
        locationId: allocation.location_id,
        quantity: toNumber(allocation.quantity),
        movementType: "consumption",
        referenceType: "production_order",
        referenceId: values.production_order_id,
        note: "Uretim malzeme tuketimi",
        userId,
      });
    }

    await updateDoc(productionOrderRef, {
      status: "in_progress",
      operator_id: values.operator_id,
      started_at: values.started_at,
      ...updateAuditFields(userId),
    });
  }

  if (values.log_type === "complete") {
    const goodQuantity = toNumber(values.good_quantity);
    const scrapQuantity = toNumber(values.scrap_quantity);

    await manualInventoryEntry({
      itemType: "model",
      itemId: productionOrder.model_id,
      lotNumber: values.lot_number,
      warehouseId: values.warehouse_id,
      locationId: values.location_id,
      quantity: goodQuantity,
      note: "Bitmis urun girisi",
      referenceType: "production_order",
      referenceId: values.production_order_id,
      userId,
      movementType: "production_output",
    });

    await updateDoc(productionOrderRef, {
      status: "completed",
      completed_at: values.completed_at,
      good_quantity: goodQuantity,
      scrap_quantity: scrapQuantity,
      ...updateAuditFields(userId),
    });
  }

  const productionLogId = await createDocument(
    COLLECTIONS.PRODUCTION_LOGS,
    values,
    userId,
  );

  await logAction({
    userId,
    action: "production_logs.create",
    entityType: COLLECTIONS.PRODUCTION_LOGS,
    entityId: productionLogId,
    details: values,
  });

  return productionLogId;
}
