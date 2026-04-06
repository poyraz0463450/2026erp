// ── UTILS ────────────────────────────────────────────────────────────────────

import { serverTimestamp } from 'firebase/firestore';

export function generateDocNumber(prefix, existing = [], regex) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((o) => {
      const m = (o.numberField || '').match(regex || new RegExp(`${prefix}-\\d{4}-(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatNumber(n) {
  return (n ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatCurrency(n, curr = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: curr }).format(n ?? 0);
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────

export const PART_CATEGORIES = ['Hammadde', 'Parça'];

export const PART_SUB_CATEGORIES = [
  'Çelik', 'Polimer', 'Yay', 'Pim', 'Vida', 'Alüminyum', 'Dövme Parça', 'Döküm Parça', 'Elektronik', 'Diğer'
];

export const PART_UNITS = ['Adet', 'Kg', 'Metre', 'mm', 'Takım', 'Litre'];

export const REVISION_STATUSES = ['Aktif', 'Pasif', 'Prototip', 'Üretimden Kalktı'];

export const STOCK_STATUSES = ['Sağlam', 'Kritik', 'Fire', 'Karantina'];

export const MOVEMENT_TYPES = [
  'Üretim Girişi', 'Satınalma Girişi', 'Transfer', 'İş Emri Çıkışı', 'Fire', 'İade', 'Sayım Düzeltme'
];

export const WORK_CENTER_TYPES = ['CNC', 'Manuel', 'Isıl İşlem', 'Montaj', 'Kaplama', 'Test', 'Paketleme'];

export const WORK_CENTER_STATUSES = ['Müsait', 'Dolu', 'Bakımda', 'Arıza'];

export const WO_TYPES = ['Seri Üretim', 'Prototip', 'Tamir', 'Numune'];

export const WO_STATUSES = ['Taslak', 'Onaylı', 'Malzeme Hazır', 'Üretimde', 'Tamamlandı', 'İptal'];

export const URGENCY_LEVELS = ['Normal', 'Acil', 'Çok Acil'];

export const INSPECTION_TYPES = ['Giriş Kalite', 'Proses', 'Final', 'Periyodik'];

export const CHARACTERISTIC_TYPES = ['Boyutsal', 'Görsel', 'Fonksiyonel', 'Yüzey'];

export const QC_RESULTS = ['Kabul', 'Red', 'Şartlı Kabul'];

export const NCR_STATUSES = ['Açık', 'İncelemede', 'Kapalı'];

export const DOC_TYPES = [
  'Teknik Resim', 'Prosedür', 'Talimat', 'Form', 'Kalite Planı', 'Test Raporu', 'Sertifika', 'MSDS'
];

export const DOC_STATUSES = ['Taslak', 'İncelemede', 'Onaylandı', 'Pasif', 'İptal'];

export const ROLE_LABELS = {
  admin: 'Sistem Yöneticisi',
  engineer: 'Malzeme Yöneticisi (PLM)',
  warehouse: 'Depo Sorumlusu',
  kalite: 'Kalite (QMS)',
  operator: 'Üretim Operatörü',
  satin_alma: 'Satınalma Uzmanı',
  viewer: 'İzleyici'
};

export const PR_STATUSES = ['Taslak', 'Pending Approval', 'Onaylandı', 'Reddedildi', 'Siparişe Dönüştü'];

export const PO_STATUSES = ['Taslak', 'Gönderildi', 'Kısmi Teslim', 'Tamamlandı', 'İptal'];

export const WO_STATUS_FLOW = ['Taslak', 'Onaylı', 'Malzeme Hazır', 'Üretimde', 'Kalitede', 'Tamamlandı', 'İptal'];

export const WO_OPERATIONS = ['CNC Torna', 'CNC Freze', 'Taşlama', 'Isıl İşlem', 'Kaplama', 'Montaj', 'Test', 'Paketleme'];

export const DOC_CATEGORIES = ['Teknik Resim', 'Prosedür', 'Talimat', 'Form', 'Kalite Planı', 'Test Raporu', 'Sertifika', 'MSDS'];

export const DOC_REV_STATUSES = ['Taslak', 'İncelemede', 'Onaylandı', 'Pasif', 'İptal'];

export const GRN_STATUSES = ['Bekliyor', 'Kısmi Kabul', 'Tam Kabul', 'Reddedildi'];

export function generateWONumber(existing = []) {
  return generateDocNumber('WO', existing);
}

export function getAQLSampling(lotSize, aql = 1.0) {
  // ISO 2859-1 Level II Normal Inspection - Code Letter Mapping
  const getCode = (lot) => {
    if (lot <= 8) return 'A';
    if (lot <= 15) return 'B';
    if (lot <= 25) return 'C';
    if (lot <= 50) return 'D';
    if (lot <= 90) return 'E';
    if (lot <= 150) return 'F';
    if (lot <= 280) return 'G';
    if (lot <= 500) return 'H';
    if (lot <= 1200) return 'J';
    if (lot <= 3200) return 'K';
    return 'L';
  };

  const code = getCode(lotSize);
  
  // Sample Size per Code
  const sampleSizes = { 
    A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50, J: 80, K: 125, L: 200 
  };
  
  // Ac/Re mapping (Simple version for common AQLs)
  const table = {
    '1.0': { A:[0,1], B:[0,1], C:[0,1], D:[0,1], E:[0,1], F:[0,1], G:[0,1], H:[1,2], J:[2,3], K:[3,4], L:[5,6] },
    '1.5': { A:[0,1], B:[0,1], C:[0,1], D:[0,1], E:[0,1], F:[0,1], G:[1,2], H:[2,3], J:[3,4], K:[5,6], L:[7,8] },
    '2.5': { A:[0,1], B:[0,1], C:[0,1], D:[0,1], E:[1,2], F:[1,2], G:[2,3], H:[3,4], J:[5,6], K:[7,8], L:[10,11] },
    '4.0': { A:[0,1], B:[0,1], C:[0,1], D:[1,2], E:[1,2], F:[2,3], G:[3,4], H:[5,6], J:[7,8], K:[10,11], L:[14,15] }
  };

  const aqlKey = String(parseFloat(aql).toFixed(1));
  const [ac, re] = table[aqlKey]?.[code] || [0, 1];
  
  return {
    code,
    sampleSize: sampleSizes[code] || lotSize,
    ac,
    re
  };
}
