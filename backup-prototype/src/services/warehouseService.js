import { COLLECTIONS } from "../constants/collections";
import { createDocument } from "./baseService";
import {
  applyCycleCount,
  consumeInventory,
  manualInventoryEntry,
  transferInventory,
} from "./inventoryService";
import { logAction } from "./logService";

export async function createWarehouse(values, userId) {
  const warehouseId = await createDocument(COLLECTIONS.WAREHOUSES, values, userId);
  await logAction({
    userId,
    action: "warehouses.create",
    entityType: COLLECTIONS.WAREHOUSES,
    entityId: warehouseId,
    details: values,
  });
  return warehouseId;
}

export async function createLocation(values, userId) {
  const locationId = await createDocument(COLLECTIONS.LOCATIONS, values, userId);
  await logAction({
    userId,
    action: "locations.create",
    entityType: COLLECTIONS.LOCATIONS,
    entityId: locationId,
    details: values,
  });
  return locationId;
}

export async function createStockMovement(values, userId) {
  if (values.movement_type === "entry") {
    return manualInventoryEntry({
      itemType: values.item_type,
      itemId: values.item_id,
      lotNumber: values.lot_number,
      warehouseId: values.warehouse_id,
      locationId: values.location_id,
      quantity: values.quantity,
      note: values.note,
      referenceType: "manual_entry",
      referenceId: values.item_id,
      userId,
    });
  }

  if (values.movement_type === "exit") {
    return consumeInventory({
      itemType: values.item_type,
      itemId: values.item_id,
      lotNumber: values.lot_number,
      warehouseId: values.warehouse_id,
      locationId: values.location_id,
      quantity: values.quantity,
      movementType: "exit",
      referenceType: "manual_exit",
      referenceId: values.item_id,
      note: values.note,
      userId,
    });
  }

  if (values.movement_type === "transfer") {
    return transferInventory({
      itemType: values.item_type,
      itemId: values.item_id,
      lotNumber: values.lot_number,
      warehouseId: values.warehouse_id,
      fromLocationId: values.from_location_id,
      toLocationId: values.to_location_id,
      quantity: values.quantity,
      note: values.note,
      userId,
    });
  }

  if (values.movement_type === "cycle_count") {
    return applyCycleCount({
      itemType: values.item_type,
      itemId: values.item_id,
      lotNumber: values.lot_number,
      warehouseId: values.warehouse_id,
      locationId: values.location_id,
      countedQuantity: values.counted_quantity,
      note: values.note,
      userId,
    });
  }

  throw new Error("Desteklenmeyen stok hareket tipi.");
}
