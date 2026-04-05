import { doc, getDoc, updateDoc } from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import { assertDb, toNumber, updateAuditFields } from "../utils/firestore";
import { createDocument } from "./baseService";
import { consumeInventory } from "./inventoryService";
import { logAction } from "./logService";

export async function createCustomer(values, userId) {
  const customerId = await createDocument(COLLECTIONS.CUSTOMERS, values, userId);
  await logAction({
    userId,
    action: "customers.create",
    entityType: COLLECTIONS.CUSTOMERS,
    entityId: customerId,
    details: values,
  });
  return customerId;
}

export async function createSalesOrder(values, userId) {
  const payload = {
    customer_id: values.customer_id,
    model_id: values.model_id,
    quantity: toNumber(values.quantity),
    due_date: values.due_date,
    status: values.status || "created",
    shipped_quantity: 0,
  };

  const salesOrderId = await createDocument(COLLECTIONS.SALES_ORDERS, payload, userId);
  await logAction({
    userId,
    action: "sales_orders.create",
    entityType: COLLECTIONS.SALES_ORDERS,
    entityId: salesOrderId,
    details: payload,
  });
  return salesOrderId;
}

export async function createShipment(values, userId) {
  const db = assertDb();
  const salesOrderRef = doc(db, COLLECTIONS.SALES_ORDERS, values.sales_order_id);
  const salesOrderSnapshot = await getDoc(salesOrderRef);

  if (!salesOrderSnapshot.exists()) {
    throw new Error("Satis siparisi bulunamadi.");
  }

  const salesOrder = salesOrderSnapshot.data();
  const remainingQuantity =
    toNumber(salesOrder.quantity) - toNumber(salesOrder.shipped_quantity);

  if (toNumber(values.quantity) > remainingQuantity) {
    throw new Error("Sevk miktari siparis miktarini asamaz.");
  }

  await consumeInventory({
    itemType: "model",
    itemId: salesOrder.model_id,
    lotNumber: values.lot_number,
    warehouseId: values.warehouse_id,
    locationId: values.location_id,
    quantity: toNumber(values.quantity),
    movementType: "shipment",
    referenceType: "sales_order",
    referenceId: values.sales_order_id,
    note: "Musteri sevkiyati",
    userId,
  });

  const shipmentId = await createDocument(
    COLLECTIONS.SHIPMENTS,
    {
      sales_order_id: values.sales_order_id,
      model_id: salesOrder.model_id,
      quantity: toNumber(values.quantity),
      ship_date: values.ship_date,
      lot_number: values.lot_number,
      warehouse_id: values.warehouse_id,
      location_id: values.location_id,
    },
    userId,
  );

  await updateDoc(salesOrderRef, {
    shipped_quantity: toNumber(salesOrder.shipped_quantity) + toNumber(values.quantity),
    status:
      toNumber(salesOrder.shipped_quantity) + toNumber(values.quantity) >=
      toNumber(salesOrder.quantity)
        ? "shipped"
        : salesOrder.status,
    ...updateAuditFields(userId),
  });

  await logAction({
    userId,
    action: "shipments.create",
    entityType: COLLECTIONS.SHIPMENTS,
    entityId: shipmentId,
    details: values,
  });

  return shipmentId;
}
