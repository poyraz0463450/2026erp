import { serverTimestamp } from "firebase/firestore";

import { db } from "../config/firebase";

export const assertDb = () => {
  if (!db) {
    throw new Error(
      "Firebase config eksik. Lutfen .env dosyasina proje bilgilerini ekleyin.",
    );
  }

  return db;
};

export const createAuditFields = (userId) => ({
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
  created_by: userId || "system",
  updated_by: userId || "system",
});

export const updateAuditFields = (userId) => ({
  updated_at: serverTimestamp(),
  updated_by: userId || "system",
});

export const stripUndefined = (payload) =>
  Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );

export const sanitizeIdPart = (value) =>
  String(value || "")
    .trim()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/[^\w-]/g, "")
    .toLowerCase();

export const makeInventoryLotId = ({
  itemType,
  itemId,
  lotNumber,
  warehouseId,
  locationId,
}) =>
  [
    sanitizeIdPart(itemType),
    sanitizeIdPart(itemId),
    sanitizeIdPart(lotNumber),
    sanitizeIdPart(warehouseId),
    sanitizeIdPart(locationId),
  ].join("__");

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sumLineTotals = (items = []) =>
  items.reduce(
    (total, item) => total + toNumber(item.quantity) * toNumber(item.unit_price),
    0,
  );
