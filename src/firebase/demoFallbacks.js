const iso = (month, day, hour = 8) =>
  new Date(Date.UTC(2026, month - 1, day, hour, 0, 0)).toISOString();

const workCenters = [
  { id: 'wc_vmc', code: 'WC-VMC', name: 'Dik İşleme Merkezi Hattı', type: 'CNC Dik İşleme', status: 'Running', capacity: 320, currentLoad: 264 },
  { id: 'wc_hmc', code: 'WC-HMC', name: 'Yatay İşleme Merkezi Hattı', type: 'CNC Yatay İşleme', status: 'Ready', capacity: 96, currentLoad: 44 },
  { id: 'wc_swiss', code: 'WC-SWT', name: 'Kayar Otomat Hücresi', type: 'Kayar Otomat', status: 'Running', capacity: 120, currentLoad: 78 },
  { id: 'wc_turn', code: 'WC-TRN', name: 'CNC Torna Hücresi', type: 'CNC Torna', status: 'Running', capacity: 96, currentLoad: 56 },
  { id: 'wc_mim', code: 'WC-MIM', name: 'Metal Enjeksiyon Hattı', type: 'Metal Enjeksiyon', status: 'Ready', capacity: 80, currentLoad: 28 },
  { id: 'wc_pim', code: 'WC-PIM', name: 'Plastik Enjeksiyon Hattı', type: 'Plastik Enjeksiyon', status: 'Running', capacity: 110, currentLoad: 72 },
  { id: 'wc_press', code: 'WC-PRS', name: 'Eksantrik Pres Hattı', type: 'Eksantrik Pres', status: 'Running', capacity: 240, currentLoad: 178 },
  { id: 'wc_broach', code: 'WC-BRO', name: 'Broş İşleme Hücresi', type: 'Broş', status: 'Ready', capacity: 60, currentLoad: 18 },
  { id: 'wc_rifling', code: 'WC-RFL', name: 'Yiv-Set Çekme Hattı', type: 'Yiv-Set Çekme', status: 'Running', capacity: 48, currentLoad: 26 },
  { id: 'wc_flat', code: 'WC-FLT', name: 'Tesviye Ünitesi', type: 'Tesviye', status: 'Ready', capacity: 40, currentLoad: 14 },
  { id: 'wc_heat', code: 'WC-HT', name: 'Isıl İşlem', type: 'Isıl İşlem', status: 'Maintenance', capacity: 72, currentLoad: 0 },
  { id: 'wc_coat', code: 'WC-COT', name: 'Kaplama / Boyahane', type: 'Kaplama', status: 'Running', capacity: 90, currentLoad: 52 },
  { id: 'wc_qc', code: 'WC-QC', name: 'Kalite Laboratuvarı', type: 'Kalite', status: 'Ready', capacity: 64, currentLoad: 20 },
  { id: 'wc_assy', code: 'WC-MNT', name: 'Nihai Montaj Hattı', type: 'Montaj', status: 'Running', capacity: 140, currentLoad: 98 },
].map((row, index) => ({
  ...row,
  createdAt: iso(3, 2 + index),
  updatedAt: iso(4, 1 + index, 10),
}));

const buildMachines = () => {
  const createSeries = (count, prefix, label, workCenterId, type, baseDay, statuses) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix.toLowerCase()}_${String(index + 1).padStart(2, '0')}`,
      code: `${prefix}-${String(index + 1).padStart(2, '0')}`,
      name: `${label} ${index + 1}`,
      type,
      workCenterId,
      status: statuses[index % statuses.length],
      createdAt: iso(3, baseDay + index),
      updatedAt: iso(4, Math.min(28, baseDay + index), 9),
    }));

  return [
    ...createSeries(10, 'VMC', 'Dik İşleme Merkezi', 'wc_vmc', 'CNC Dik İşleme', 1, ['Running', 'Ready', 'Ready', 'Maintenance']),
    ...createSeries(2, 'HMC', 'Yatay İşleme Merkezi', 'wc_hmc', 'CNC Yatay İşleme', 12, ['Ready', 'Running']),
    ...createSeries(2, 'SWT', 'Kayar Otomat', 'wc_swiss', 'Kayar Otomat', 14, ['Running', 'Ready']),
    ...createSeries(2, 'TRN', 'CNC Torna', 'wc_turn', 'CNC Torna', 16, ['Running', 'Ready']),
    ...createSeries(2, 'MIM', 'Metal Enjeksiyon Presi', 'wc_mim', 'Metal Enjeksiyon', 18, ['Ready', 'Running']),
    ...createSeries(2, 'PIM', 'Plastik Enjeksiyon Presi', 'wc_pim', 'Plastik Enjeksiyon', 20, ['Running', 'Ready']),
    ...createSeries(5, 'PRS', 'Eksantrik Pres', 'wc_press', 'Eksantrik Pres', 22, ['Running', 'Ready', 'Running', 'Down']),
    ...createSeries(2, 'BRO', 'Broş Makinesi', 'wc_broach', 'Broş', 27, ['Ready', 'Maintenance']),
    ...createSeries(2, 'RFL', 'Yiv-Set Çekme Makinesi', 'wc_rifling', 'Yiv-Set Çekme', 29, ['Running', 'Ready']),
    ...createSeries(1, 'FLT', 'Tesviye İstasyonu', 'wc_flat', 'Tesviye', 31, ['Ready']),
  ];
};

const documents = [
  ['doc_001', 'DRW-ART9-001', 'Alt Gövde Teknik Resmi', 'Teknik Resim', 'part_assy_lower', 'ASM-ALT-GOVDE-001', 'A', 'Onaylandı', 'DRW-ART9-001.pdf'],
  ['doc_002', 'DRW-ART9-002', 'Sürgü Teknik Resmi', 'Teknik Resim', 'part_assy_slide', 'ASM-SURG-001', 'A', 'Onaylandı', 'DRW-ART9-002.pdf'],
  ['doc_003', 'DRW-ART9-003', 'Namlu İşleme Talimatı', 'Talimat', 'part_barrel_std', 'PAR-NAMLU-001', 'B', 'Onaylandı', 'DRW-ART9-003.pdf'],
  ['doc_004', 'DRW-ART9-004', 'Dişli Namlu Kontrol Planı', 'Kalite Planı', 'part_barrel_tac', 'PAR-NAMLU-002', 'A', 'İncelemede', 'DRW-ART9-004.pdf'],
  ['doc_005', 'DRW-ART9-005', 'Şarjör Montaj Talimatı', 'Talimat', 'part_assy_mag', 'ASM-SARJOR-001', 'A', 'Onaylandı', 'DRW-ART9-005.pdf'],
  ['doc_006', 'DRW-ART9-006', 'ART-9 Gen2 Final Test Prosedürü', 'Prosedür', 'part_product_g2', 'PRD-ART9-G2', 'A', 'Onaylandı', 'DRW-ART9-006.pdf'],
  ['doc_007', 'DRW-ART9-007', 'ART-9 Tactical Konfigürasyon Paketi', 'Teknik Resim', 'part_product_tac', 'PRD-ART9-TAC', 'A', 'Onaylandı', 'DRW-ART9-007.pdf'],
  ['doc_008', 'DRW-ART9-008', 'ART-9 Compact Üretim Notları', 'Form', 'part_product_cmp', 'PRD-ART9-CMP', 'A', 'Taslak', 'DRW-ART9-008.pdf'],
  ['doc_009', 'DRW-ART9-009', 'Kaplama Prosesi İş Akışı', 'Prosedür', '', '', 'C', 'Onaylandı', 'DRW-ART9-009.pdf'],
  ['doc_010', 'DRW-ART9-010', 'Lot İzlenebilirlik Formu', 'Form', '', '', 'B', 'Onaylandı', 'DRW-ART9-010.pdf'],
].map((row, index) => ({
  id: row[0],
  docNumber: row[1],
  title: row[2],
  category: row[3],
  linkedPartId: row[4],
  linkedPartNumber: row[5],
  revision: row[6],
  revisionStatus: row[7],
  fileName: row[8],
  description: 'Yerel demo dokümanı. PDF yükleme aktif olmadığında demo akışını destekler.',
  isDownloadable: true,
  uploadedBy: 'Mehmet Poyraz',
  updatedBy: 'Mehmet Poyraz',
  createdAt: iso(3, 5 + index),
  updatedAt: iso(4, 2 + index, 11),
}));

const supplierParts = [
  ['sp_001', 'supplier_akyol', 'Akyol Çelik', 'part_rm_4140_20', 'HAM-4140-020', '4140 Çelik Çubuk 20 mm', 320, 'TRY', 18, true],
  ['sp_002', 'supplier_akyol', 'Akyol Çelik', 'part_rm_42crmo4', 'HAM-42CRMO4-001', '42CrMo4 Dövme Taslak', 585, 'TRY', 20, true],
  ['sp_003', 'supplier_ulusoy', 'Ulusoy Alüminyum', 'part_rm_7075', 'HAM-7075-PLK', '7075 Alüminyum Plaka', 430, 'TRY', 12, true],
  ['sp_004', 'supplier_delta', 'Delta Polimer', 'part_grip_r', 'PAR-KABZA-SAG-001', 'Kabza Sağ Panel', 86, 'TRY', 10, true],
  ['sp_005', 'supplier_delta', 'Delta Polimer', 'part_grip_l', 'PAR-KABZA-SOL-001', 'Kabza Sol Panel', 86, 'TRY', 10, true],
  ['sp_006', 'supplier_kuzey', 'Kuzey Yay', 'part_mag_spring', 'PAR-SARJOR-YAY-001', 'Şarjör Yayı', 12.5, 'TRY', 7, true],
  ['sp_007', 'supplier_ates', 'Ateş Kaplama', 'part_barrel_std', 'PAR-NAMLU-001', 'Standart Namlu 9x19', 1240, 'TRY', 14, true],
  ['sp_008', 'supplier_ates', 'Ateş Kaplama', 'part_barrel_tac', 'PAR-NAMLU-002', 'Dişli Namlu 9x19', 1380, 'TRY', 14, true],
].map((row, index) => ({
  id: row[0],
  supplierId: row[1],
  supplierName: row[2],
  partId: row[3],
  partNumber: row[4],
  partName: row[5],
  unitPrice: row[6],
  currency: row[7],
  leadTimeDays: row[8],
  isPreferred: row[9],
  createdAt: iso(3, 8 + index),
  updatedAt: iso(4, 5 + index, 10),
}));

const purchaseInvoices = [
  ['ap_001', 'AP-2026-0001', 'PO-2026-0001', 'Akyol Çelik', 79800, 'TRY', '2026-03-18', '2026-04-18', 'Bekliyor'],
  ['ap_002', 'AP-2026-0002', 'PO-2026-0003', 'Akyol Çelik', 139200, 'TRY', '2026-04-03', '2026-05-03', 'Onaylandı'],
  ['ap_003', 'AP-2026-0003', 'PO-2026-0005', 'Ateş Kaplama', 83400, 'TRY', '2026-03-19', '2026-04-19', 'Ödendi'],
];

const salesInvoices = [
  ['ar_001', 'INV-2026-0001', 'Kara Sistemleri Başkanlığı', 'PRD-ART9-G2', 12, 46200, 'USD', 'Pending', '2026-04-10'],
  ['ar_002', 'INV-2026-0002', 'Atlas Tactical Systems', 'PRD-ART9-G2', 4, 15700, 'USD', 'Paid', '2026-04-04'],
  ['ar_003', 'INV-2026-0003', 'Anka Savunma Tedarik', 'PRD-ART9-SD', 15, 54150, 'USD', 'Pending', '2026-04-18'],
];

const invoices = [
  ...purchaseInvoices.map((row, index) => ({
    id: row[0],
    invoiceKind: 'purchase',
    invoiceNo: row[1],
    poNumber: row[2],
    supplierName: row[3],
    amount: row[4],
    totalAmount: row[4],
    currency: row[5],
    invoiceDate: row[6],
    dueDate: row[7],
    status: row[8],
    paymentStatus: row[8] === 'Ödendi' ? 'Paid' : 'Pending',
    createdAt: iso(3, 12 + index),
    updatedAt: iso(4, 2 + index, 9),
  })),
  ...salesInvoices.map((row, index) => ({
    id: row[0],
    invoiceKind: 'sales',
    invoiceNo: row[1],
    customerName: row[2],
    partNumber: row[3],
    quantity: row[4],
    totalAmount: row[5],
    currency: row[6],
    paymentStatus: row[7],
    status: row[7] === 'Paid' ? 'Kesildi' : 'Taslak',
    invoiceDate: row[8],
    amount: row[5],
    createdAt: iso(4, 8 + index),
    updatedAt: iso(4, 8 + index, 10),
  })),
];

const rfqs = [
  {
    id: 'rfq_001',
    rfqNumber: 'TKL-2026-0001',
    prId: 'pr_005',
    partId: 'part_barrel_tac',
    partNumber: 'PAR-NAMLU-002',
    partName: 'Dişli Namlu 9x19',
    requestedQty: 40,
    targetDeliveryDate: '2026-04-18',
    status: 'Değerlendirmede',
    vendors: [
      { supplierId: 'supplier_ates', supplierName: 'Ateş Kaplama', unitPrice: 1380, currency: 'TRY', leadTimeDays: 14, status: 'Alındı' },
      { supplierId: 'supplier_akyol', supplierName: 'Akyol Çelik', unitPrice: 1445, currency: 'TRY', leadTimeDays: 18, status: 'Alındı' },
    ],
    createdAt: iso(4, 2),
    updatedAt: iso(4, 3, 11),
  },
  {
    id: 'rfq_002',
    rfqNumber: 'TKL-2026-0002',
    prId: 'pr_004',
    partId: 'part_grip_r',
    partNumber: 'PAR-KABZA-SAG-001',
    partName: 'Kabza Sağ Panel',
    requestedQty: 150,
    targetDeliveryDate: '2026-04-22',
    status: 'Açık',
    vendors: [
      { supplierId: 'supplier_delta', supplierName: 'Delta Polimer', unitPrice: 86, currency: 'TRY', leadTimeDays: 10, status: 'Bekleniyor' },
    ],
    createdAt: iso(4, 5),
    updatedAt: iso(4, 5, 9),
  },
];

const asns = [
  {
    id: 'asn_001',
    asnNumber: 'ASN-2026-0001',
    poNumber: 'PO-2026-0003',
    supplierName: 'Akyol Çelik',
    shipDate: '2026-04-04',
    estimatedArrival: '2026-04-07',
    carrier: 'Yurtiçi Endüstriyel',
    trackingNumber: 'YK-TR-98231',
    status: 'Yolda',
    createdAt: iso(4, 4),
    updatedAt: iso(4, 4, 13),
  },
  {
    id: 'asn_002',
    asnNumber: 'ASN-2026-0002',
    poNumber: 'PO-2026-0004',
    supplierName: 'Kuzey Yay',
    shipDate: '2026-04-05',
    estimatedArrival: '2026-04-06',
    carrier: 'Aras Sanayi',
    trackingNumber: 'ARS-441290',
    status: 'Yolda',
    createdAt: iso(4, 5),
    updatedAt: iso(4, 5, 12),
  },
];

const cycleCounts = [
  { id: 'cc_001', partId: 'part_rm_4140_20', partNumber: 'HAM-4140-020', partName: '4140 Çelik Çubuk 20 mm', systemQty: 140, countedQty: 138, location: 'HAM-A01-01', note: 'Kesim fire farkı', status: 'Tamamlandı', createdBy: 'Can Depo', approvedBy: 'Mehmet Poyraz', createdAt: iso(4, 1), updatedAt: iso(4, 1, 12) },
  { id: 'cc_002', partId: 'part_barrel_std', partNumber: 'PAR-NAMLU-001', partName: 'Standart Namlu 9x19', systemQty: 26, countedQty: 26, location: 'KMP-B03-01', note: 'Uygun', status: 'Tamamlandı', createdBy: 'Can Depo', approvedBy: 'Mehmet Poyraz', createdAt: iso(4, 2), updatedAt: iso(4, 2, 12) },
  { id: 'cc_003', partId: 'part_mag_body', partNumber: 'PAR-SARJOR-001', partName: 'Şarjör Gövdesi', systemQty: 55, countedQty: 52, location: 'KMP-B08-01', note: 'Sayım farkı kontrol bekliyor', status: 'Taslak', createdBy: 'Can Depo', createdAt: iso(4, 4), updatedAt: iso(4, 4, 10) },
  { id: 'cc_004', partId: 'part_product_g2', partNumber: 'PRD-ART9-G2', partName: 'ART-9 Gen2 Tabanca', systemQty: 12, countedQty: 12, location: 'FG-D01-01', note: 'Final depo sayımı', status: 'Taslak', createdBy: 'Ayşe Depo', createdAt: iso(4, 5), updatedAt: iso(4, 5, 11) },
];

const measuringTools = [
  ['tool_001', 'Dijital Kumpas 0-150', 'QC-T-001', 'SN-DC-1101', '2026-01-10', '2026-07-10', 'Aktif'],
  ['tool_002', 'Mikrometre 25-50', 'QC-T-002', 'SN-MK-2204', '2026-02-05', '2026-08-05', 'Aktif'],
  ['tool_003', 'İç Çap Komparatörü', 'QC-T-003', 'SN-IC-3308', '2025-10-14', '2026-04-01', 'Süresi Dolmuş'],
  ['tool_004', 'Yüzey Pürüzlülük Ölçer', 'QC-T-004', 'SN-RA-4102', '2026-03-12', '2026-09-12', 'Aktif'],
  ['tool_005', 'CMM Prob Seti', 'QC-T-005', 'SN-CMM-9121', '2025-09-20', '2026-03-20', 'Süresi Dolmuş'],
  ['tool_006', 'Tetik Kuvvet Ölçer', 'QC-T-006', 'SN-TK-1045', '2026-01-22', '2026-05-15', 'Aktif'],
].map((row, index) => ({
  id: row[0],
  name: row[1],
  toolId: row[2],
  serialNo: row[3],
  lastCalibration: row[4],
  nextCalibration: row[5],
  status: row[6],
  createdAt: iso(3, 10 + index),
  updatedAt: iso(4, 2 + index, 8),
}));

const priceHistory = [
  ['ph_001', 'part_rm_4140_20', 'HAM-4140-020', 'Akyol Çelik', 305],
  ['ph_002', 'part_rm_4140_20', 'HAM-4140-020', 'Akyol Çelik', 320],
  ['ph_003', 'part_barrel_std', 'PAR-NAMLU-001', 'Ateş Kaplama', 1180],
  ['ph_004', 'part_barrel_std', 'PAR-NAMLU-001', 'Ateş Kaplama', 1240],
  ['ph_005', 'part_mag_spring', 'PAR-SARJOR-YAY-001', 'Kuzey Yay', 11.4],
  ['ph_006', 'part_mag_spring', 'PAR-SARJOR-YAY-001', 'Kuzey Yay', 12.5],
].map((row, index) => ({
  id: row[0],
  partId: row[1],
  partNumber: row[2],
  supplierName: row[3],
  unitPrice: row[4],
  currency: 'TRY',
  createdAt: iso(2, 14 + index),
  updatedAt: iso(2, 14 + index, 9),
}));

const settings = [
  {
    id: 'financials',
    laborRate: 27,
    overheadPercent: 18,
    createdAt: iso(1, 4),
    updatedAt: iso(4, 1, 9),
  },
];

export const LOCAL_DEMO_COLLECTIONS = {
  work_centers: workCenters,
  machines: buildMachines(),
  documents,
  supplier_parts: supplierParts,
  sales_invoices: invoices,
  rfq: rfqs,
  asn: asns,
  cycle_counts: cycleCounts,
  measuring_tools: measuringTools,
  price_history: priceHistory,
  settings,
};

