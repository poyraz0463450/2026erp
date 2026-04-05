import {
  collection,
  doc,
  getDoc,
  runTransaction,
} from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import {
  assertDb,
  createAuditFields,
  stripUndefined,
  sumLineTotals,
  toNumber,
  updateAuditFields,
} from "../utils/firestore";
import { createDocument, deleteDocumentById } from "./baseService";
import { receivePurchasedItem } from "./inventoryService";
import { logAction } from "./logService";

export async function createSupplier(values, userId) {
  const supplierId = await createDocument(COLLECTIONS.SUPPLIERS, values, userId);
  await logAction({
    userId,
    action: "suppliers.create",
    entityType: COLLECTIONS.SUPPLIERS,
    entityId: supplierId,
    details: values,
  });
  return supplierId;
}

export async function deleteSupplier(supplierId, userId) {
  await deleteDocumentById(COLLECTIONS.SUPPLIERS, supplierId);
  await logAction({
    userId,
    action: "suppliers.delete",
    entityType: COLLECTIONS.SUPPLIERS,
    entityId: supplierId,
  });
}

export async function createPurchaseRequest(values, userId) {
  if (toNumber(values.quantity) <= 0) {
    throw new Error("Talep miktari sifirdan buyuk olmalidir.");
  }

  const payload = {
    part_id: values.part_id,
    quantity: toNumber(values.quantity),
    request_date: values.request_date,
    description: values.description,
    status: values.status || "pending",
  };
  const requestId = await createDocument(COLLECTIONS.PURCHASE_REQUESTS, payload, userId);
  await logAction({
    userId,
    action: "purchase_requests.create",
    entityType: COLLECTIONS.PURCHASE_REQUESTS,
    entityId: requestId,
    details: payload,
  });
  return requestId;
}

export async function createPurchaseOrder(values, userId) {
  const items = (values.items || [])
    .filter((item) => item.part_id && toNumber(item.quantity) > 0)
    .map((item) => ({
      part_id: item.part_id,
      quantity: toNumber(item.quantity),
      received_quantity: 0,
      unit_price: toNumber(item.unit_price),
      line_total: toNumber(item.quantity) * toNumber(item.unit_price),
    }));

  if (!values.supplier_id) {
    throw new Error("Tedarikci secimi zorunludur.");
  }

  if (!items.length) {
    throw new Error("En az bir siparis kalemi eklemelisiniz.");
  }

  const payload = {
    supplier_id: values.supplier_id,
    purchase_request_id: values.purchase_request_id,
    order_date: values.order_date,
    status: values.status || "created",
    items,
    total_amount: sumLineTotals(items),
  };

  const orderId = await createDocument(COLLECTIONS.PURCHASE_ORDERS, payload, userId);

  await logAction({
    userId,
    action: "purchase_orders.create",
    entityType: COLLECTIONS.PURCHASE_ORDERS,
    entityId: orderId,
    details: payload,
  });

  return orderId;
}

export async function createGoodsReceipt(values, userId) {
  if (toNumber(values.received_quantity) <= 0) {
    throw new Error("Gelen miktar sifirdan buyuk olmalidir.");
  }

  const db = assertDb();
  let createdReceiptId = "";

  await runTransaction(db, async (transaction) => {
    const purchaseOrderRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, values.purchase_order_id);
    const purchaseOrderSnapshot = await transaction.get(purchaseOrderRef);

    if (!purchaseOrderSnapshot.exists()) {
      throw new Error("Satin alma siparisi bulunamadi.");
    }

    const purchaseOrder = purchaseOrderSnapshot.data();

    if (purchaseOrder.status === "cancelled") {
      throw new Error("Iptal edilmis siparis icin mal kabul yapilamaz.");
    }

    const targetItemIndex = purchaseOrder.items.findIndex(
      (item) => item.part_id === values.part_id,
    );

    if (targetItemIndex < 0) {
      throw new Error("Secilen parca siparis kalemlerinde bulunamadi.");
    }

    const targetItem = purchaseOrder.items[targetItemIndex];
    const remainingQuantity =
      toNumber(targetItem.quantity) - toNumber(targetItem.received_quantity);

    if (toNumber(values.received_quantity) > remainingQuantity) {
      throw new Error("Gelen miktar siparis miktarini asamaz.");
    }

    const receiptRef = doc(collection(db, COLLECTIONS.GOODS_RECEIPTS));
    createdReceiptId = receiptRef.id;

    const nextItems = [...purchaseOrder.items];
    nextItems[targetItemIndex] = {
      ...targetItem,
      received_quantity:
        toNumber(targetItem.received_quantity) + toNumber(values.received_quantity),
    };

    const isFullyReceived = nextItems.every(
      (item) => toNumber(item.received_quantity) >= toNumber(item.quantity),
    );

    transaction.set(
      receiptRef,
      stripUndefined({
        purchase_order_id: values.purchase_order_id,
        supplier_id: purchaseOrder.supplier_id,
        part_id: values.part_id,
        received_quantity: toNumber(values.received_quantity),
        lot_number: values.lot_number,
        warehouse_id: values.warehouse_id,
        location_id: values.location_id,
        receipt_date: values.receipt_date,
        qc_status: "pending",
        ...createAuditFields(userId),
      }),
    );

    transaction.update(purchaseOrderRef, {
      items: nextItems,
      status: isFullyReceived ? "received" : purchaseOrder.status,
      ...updateAuditFields(userId),
    });
  });

  await receivePurchasedItem({
    itemId: values.part_id,
    lotNumber: values.lot_number,
    warehouseId: values.warehouse_id,
    locationId: values.location_id,
    quantity: toNumber(values.received_quantity),
    goodsReceiptId: createdReceiptId,
    purchaseOrderId: values.purchase_order_id,
    userId,
  });

  await logAction({
    userId,
    action: "goods_receipts.create",
    entityType: COLLECTIONS.GOODS_RECEIPTS,
    entityId: createdReceiptId,
    details: values,
  });

  return createdReceiptId;
}

export async function getPurchaseOrderById(orderId) {
  const db = assertDb();
  const snapshot = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, orderId));

  if (!snapshot.exists()) {
    throw new Error("Siparis bulunamadi.");
  }

  return { id: snapshot.id, ...snapshot.data() };
}
