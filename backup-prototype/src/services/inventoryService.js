import {
  collection,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
} from "firebase/firestore";

import { COLLECTIONS } from "../constants/collections";
import {
  assertDb,
  createAuditFields,
  makeInventoryLotId,
  stripUndefined,
  toNumber,
  updateAuditFields,
} from "../utils/firestore";
import { logAction } from "./logService";

const buildLotState = ({
  currentData,
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  deltas,
  userId,
}) => {
  const onHandQuantity =
    toNumber(currentData?.on_hand_quantity) + toNumber(deltas.on_hand_quantity);
  const availableQuantity =
    toNumber(currentData?.available_quantity) + toNumber(deltas.available_quantity);
  const quarantineQuantity =
    toNumber(currentData?.quarantine_quantity) + toNumber(deltas.quarantine_quantity);
  const rejectedQuantity =
    toNumber(currentData?.rejected_quantity) + toNumber(deltas.rejected_quantity);

  if (
    onHandQuantity < 0 ||
    availableQuantity < 0 ||
    quarantineQuantity < 0 ||
    rejectedQuantity < 0
  ) {
    throw new Error("Negatif stok olusamaz.");
  }

  return stripUndefined({
    ...(currentData || {}),
    item_type: itemType,
    item_id: itemId,
    lot_number: lotNumber,
    warehouse_id: warehouseId,
    location_id: locationId,
    on_hand_quantity: onHandQuantity,
    available_quantity: availableQuantity,
    quarantine_quantity: quarantineQuantity,
    rejected_quantity: rejectedQuantity,
    ...(currentData ? updateAuditFields(userId) : createAuditFields(userId)),
  });
};

function appendStockMovement({
  transaction,
  db,
  userId,
  movementType,
  quantity,
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  fromLocationId,
  toLocationId,
  referenceType,
  referenceId,
  note,
}) {
  const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
  transaction.set(
    movementRef,
    stripUndefined({
      movement_type: movementType,
      quantity: toNumber(quantity),
      item_type: itemType,
      item_id: itemId,
      lot_number: lotNumber,
      warehouse_id: warehouseId,
      location_id: locationId,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      reference_type: referenceType,
      reference_id: referenceId,
      note,
      ...createAuditFields(userId),
    }),
  );
}

export async function receivePurchasedItem({
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  quantity,
  goodsReceiptId,
  purchaseOrderId,
  userId,
}) {
  const db = assertDb();

  await runTransaction(db, async (transaction) => {
    const lotRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType: "part",
        itemId,
        lotNumber,
        warehouseId,
        locationId,
      }),
    );
    const lotSnapshot = await transaction.get(lotRef);
    const nextLot = buildLotState({
      currentData: lotSnapshot.exists() ? lotSnapshot.data() : null,
      itemType: "part",
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      deltas: {
        on_hand_quantity: quantity,
        available_quantity: 0,
        quarantine_quantity: quantity,
        rejected_quantity: 0,
      },
      userId,
    });

    transaction.set(lotRef, nextLot, { merge: true });
    appendStockMovement({
      transaction,
      db,
      userId,
      movementType: "receipt",
      quantity,
      itemType: "part",
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      referenceType: "purchase_order",
      referenceId: purchaseOrderId || goodsReceiptId,
      note: "Mal kabul ile karantinaya alindi.",
    });
  });

  await logAction({
    userId,
    action: "inventory.receipt",
    entityType: COLLECTIONS.INVENTORY_LOTS,
    entityId: goodsReceiptId,
    details: { itemId, lotNumber, warehouseId, locationId, quantity },
  });
}

export async function applyIncomingQcDecision({
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  quantity,
  result,
  qualityRecordId,
  userId,
}) {
  const db = assertDb();

  await runTransaction(db, async (transaction) => {
    const lotRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType: "part",
        itemId,
        lotNumber,
        warehouseId,
        locationId,
      }),
    );
    const lotSnapshot = await transaction.get(lotRef);

    if (!lotSnapshot.exists()) {
      throw new Error("QC icin ilgili stok lotu bulunamadi.");
    }

    const nextLot = buildLotState({
      currentData: lotSnapshot.data(),
      itemType: "part",
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      deltas: {
        on_hand_quantity: 0,
        available_quantity: result === "accepted" ? quantity : 0,
        quarantine_quantity: result === "conditional" ? 0 : -quantity,
        rejected_quantity: result === "rejected" ? quantity : 0,
      },
      userId,
    });

    transaction.set(lotRef, nextLot, { merge: true });
    appendStockMovement({
      transaction,
      db,
      userId,
      movementType: "quality_release",
      quantity,
      itemType: "part",
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      referenceType: "quality_record",
      referenceId: qualityRecordId,
      note:
        result === "accepted"
          ? "Giris kalite kontrol kabul"
          : result === "rejected"
            ? "Giris kalite kontrol red"
            : "Giris kalite kontrol sartli kabul",
    });
  });

  await logAction({
    userId,
    action: "inventory.qc_decision",
    entityType: COLLECTIONS.INVENTORY_LOTS,
    entityId: qualityRecordId,
    details: { itemId, lotNumber, warehouseId, locationId, quantity, result },
  });
}

export async function manualInventoryEntry({
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  quantity,
  note,
  referenceType,
  referenceId,
  userId,
  movementType = "entry",
}) {
  const db = assertDb();

  await runTransaction(db, async (transaction) => {
    const lotRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType,
        itemId,
        lotNumber,
        warehouseId,
        locationId,
      }),
    );
    const lotSnapshot = await transaction.get(lotRef);
    const nextLot = buildLotState({
      currentData: lotSnapshot.exists() ? lotSnapshot.data() : null,
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      deltas: {
        on_hand_quantity: quantity,
        available_quantity: quantity,
        quarantine_quantity: 0,
        rejected_quantity: 0,
      },
      userId,
    });

    transaction.set(lotRef, nextLot, { merge: true });
    appendStockMovement({
      transaction,
      db,
      userId,
      movementType,
      quantity: Math.abs(quantity),
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      referenceType,
      referenceId,
      note,
    });
  });

  await logAction({
    userId,
    action: `inventory.${movementType}`,
    entityType: COLLECTIONS.INVENTORY_LOTS,
    entityId: `${itemType}:${itemId}`,
    details: { lotNumber, quantity, warehouseId, locationId, referenceType, referenceId },
  });
}

export async function consumeInventory({
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  quantity,
  movementType,
  referenceType,
  referenceId,
  note,
  userId,
}) {
  const db = assertDb();

  await runTransaction(db, async (transaction) => {
    const lotRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType,
        itemId,
        lotNumber,
        warehouseId,
        locationId,
      }),
    );
    const lotSnapshot = await transaction.get(lotRef);

    if (!lotSnapshot.exists()) {
      throw new Error("Tuketilecek stok lotu bulunamadi.");
    }

    const nextLot = buildLotState({
      currentData: lotSnapshot.data(),
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      deltas: {
        on_hand_quantity: -quantity,
        available_quantity: -quantity,
        quarantine_quantity: 0,
        rejected_quantity: 0,
      },
      userId,
    });

    transaction.set(lotRef, nextLot, { merge: true });
    appendStockMovement({
      transaction,
      db,
      userId,
      movementType,
      quantity,
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      referenceType,
      referenceId,
      note,
    });
  });

  await logAction({
    userId,
    action: `inventory.${movementType}`,
    entityType: COLLECTIONS.INVENTORY_LOTS,
    entityId: `${itemType}:${itemId}`,
    details: { lotNumber, quantity, warehouseId, locationId, referenceType, referenceId },
  });
}

export async function transferInventory({
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  fromLocationId,
  toLocationId,
  quantity,
  note,
  userId,
}) {
  const db = assertDb();

  await runTransaction(db, async (transaction) => {
    const sourceRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType,
        itemId,
        lotNumber,
        warehouseId,
        locationId: fromLocationId,
      }),
    );
    const targetRef = doc(
      db,
      COLLECTIONS.INVENTORY_LOTS,
      makeInventoryLotId({
        itemType,
        itemId,
        lotNumber,
        warehouseId,
        locationId: toLocationId,
      }),
    );
    const sourceSnapshot = await transaction.get(sourceRef);
    const targetSnapshot = await transaction.get(targetRef);

    if (!sourceSnapshot.exists()) {
      throw new Error("Kaynak lot bulunamadi.");
    }

    const nextSourceLot = buildLotState({
      currentData: sourceSnapshot.data(),
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId: fromLocationId,
      deltas: {
        on_hand_quantity: -quantity,
        available_quantity: -quantity,
        quarantine_quantity: 0,
        rejected_quantity: 0,
      },
      userId,
    });

    const nextTargetLot = buildLotState({
      currentData: targetSnapshot.exists() ? targetSnapshot.data() : null,
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId: toLocationId,
      deltas: {
        on_hand_quantity: quantity,
        available_quantity: quantity,
        quarantine_quantity: 0,
        rejected_quantity: 0,
      },
      userId,
    });

    transaction.set(sourceRef, nextSourceLot, { merge: true });
    transaction.set(targetRef, nextTargetLot, { merge: true });
    appendStockMovement({
      transaction,
      db,
      userId,
      movementType: "transfer",
      quantity,
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId: toLocationId,
      fromLocationId,
      toLocationId,
      note,
    });
  });

  await logAction({
    userId,
    action: "inventory.transfer",
    entityType: COLLECTIONS.INVENTORY_LOTS,
    entityId: `${itemType}:${itemId}`,
    details: { lotNumber, quantity, warehouseId, fromLocationId, toLocationId },
  });
}

export async function applyCycleCount({
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
  countedQuantity,
  note,
  userId,
}) {
  const db = assertDb();
  const lotRef = doc(
    db,
    COLLECTIONS.INVENTORY_LOTS,
    makeInventoryLotId({
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
    }),
  );
  const lotSnapshot = await getDoc(lotRef);

  if (!lotSnapshot.exists()) {
    throw new Error("Sayim duzeltmesi icin lot bulunamadi.");
  }

  const currentLot = lotSnapshot.data();
  const difference = toNumber(countedQuantity) - toNumber(currentLot.available_quantity);

  if (difference === 0) {
    return;
  }

  if (difference > 0) {
    await manualInventoryEntry({
      itemType,
      itemId,
      lotNumber,
      warehouseId,
      locationId,
      quantity: difference,
      note: note || "Cycle count duzeltmesi",
      referenceType: "cycle_count",
      referenceId: `${itemType}:${itemId}`,
      userId,
      movementType: "cycle_count",
    });
    return;
  }

  await consumeInventory({
    itemType,
    itemId,
    lotNumber,
    warehouseId,
    locationId,
    quantity: Math.abs(difference),
    movementType: "cycle_count",
    referenceType: "cycle_count",
    referenceId: `${itemType}:${itemId}`,
    note: note || "Cycle count duzeltmesi",
    userId,
  });
}

export async function updateGoodsReceiptQcStatus(goodsReceiptId, qcStatus, userId) {
  const db = assertDb();
  await updateDoc(doc(db, COLLECTIONS.GOODS_RECEIPTS, goodsReceiptId), {
    qc_status: qcStatus,
    ...updateAuditFields(userId),
  });
}
