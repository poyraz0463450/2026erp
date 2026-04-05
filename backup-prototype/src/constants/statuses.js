export const USER_ROLES = [
  { value: "admin", label: "Yonetici" },
  { value: "engineer", label: "Muhendis" },
  { value: "operator", label: "Operator" },
];

export const ROLE_LABELS = Object.fromEntries(
  USER_ROLES.map((role) => [role.value, role.label]),
);

export const PURCHASE_REQUEST_STATUSES = [
  { value: "pending", label: "Beklemede" },
  { value: "approved", label: "Onaylandi" },
  { value: "rejected", label: "Reddedildi" },
];

export const PURCHASE_ORDER_STATUSES = [
  { value: "created", label: "Olusturuldu" },
  { value: "sent", label: "Gonderildi" },
  { value: "received", label: "Teslim Alindi" },
  { value: "cancelled", label: "Iptal Edildi" },
];

export const QUALITY_RESULTS = [
  { value: "accepted", label: "Kabul" },
  { value: "rejected", label: "Red" },
  { value: "conditional", label: "Sartli Kabul" },
];

export const QUALITY_TYPES = [
  { value: "incoming", label: "Giris Kalite Kontrol" },
  { value: "in_process", label: "Proses Ici Kalite Kontrol" },
  { value: "final", label: "Final Kontrol" },
  { value: "start", label: "Baslatma" },
  { value: "complete", label: "Tamamlama" },
];

export const NONCONFORMITY_ACTIONS = [
  { value: "rework", label: "Yeniden Isleme" },
  { value: "scrap", label: "Hurda" },
  { value: "accept", label: "Kabul" },
];

export const MOVEMENT_TYPES = [
  { value: "entry", label: "Stok Girisi" },
  { value: "exit", label: "Stok Cikisi" },
  { value: "transfer", label: "Transfer" },
  { value: "cycle_count", label: "Sayim" },
  { value: "receipt", label: "Mal Kabul" },
  { value: "quality_release", label: "Kalite Serbest Birakma" },
  { value: "consumption", label: "Uretim Tuketimi" },
  { value: "production_output", label: "Uretim Ciktisi" },
  { value: "shipment", label: "Sevkiyat" },
];

export const SALES_ORDER_STATUSES = [
  { value: "created", label: "Olusturuldu" },
  { value: "confirmed", label: "Onaylandi" },
  { value: "in_production", label: "Uretimde" },
  { value: "shipped", label: "Sevk Edildi" },
  { value: "completed", label: "Tamamlandi" },
];

export const OPERATION_STATUSES = [
  { value: "pending", label: "Beklemede" },
  { value: "in_progress", label: "Devam Ediyor" },
  { value: "completed", label: "Tamamlandi" },
];

export const ITEM_TYPES = [
  { value: "part", label: "Parca" },
  { value: "model", label: "Model" },
];

const allStatusEntries = [
  ...USER_ROLES,
  ...PURCHASE_REQUEST_STATUSES,
  ...PURCHASE_ORDER_STATUSES,
  ...QUALITY_RESULTS,
  ...QUALITY_TYPES,
  ...NONCONFORMITY_ACTIONS,
  ...MOVEMENT_TYPES,
  ...SALES_ORDER_STATUSES,
  ...OPERATION_STATUSES,
  ...ITEM_TYPES,
  { value: "open", label: "Acik" },
  { value: "sent", label: "Gonderildi" },
  { value: "shipped", label: "Sevk Edildi" },
  { value: "confirmed", label: "Onaylandi" },
  { value: "pending", label: "Beklemede" },
  { value: "incoming", label: "Giris Kalite Kontrol" },
  { value: "in_process", label: "Proses Ici Kalite Kontrol" },
  { value: "final", label: "Final Kontrol" },
];

export const STATUS_LABELS = Object.fromEntries(
  allStatusEntries.map((entry) => [entry.value, entry.label]),
);
