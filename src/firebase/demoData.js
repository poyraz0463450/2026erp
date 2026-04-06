import { doc, writeBatch } from 'firebase/firestore';
import { db } from './config';

const BASE = new Date(Date.UTC(2026, 2, 1, 8, 0, 0));

const at = (day = 0, hour = 8) => {
  const value = new Date(BASE);
  value.setUTCDate(value.getUTCDate() + day);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
};

const stockStatus = (currentStock, minStock, forced) => forced || (currentStock <= minStock ? 'Kritik' : 'Sağlam');
const mapById = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]));

export async function seedDemoData({ currentUserName = 'Sistem Yöneticisi', currentUserEmail = 'admin@artegon.local' } = {}) {
  const suppliers = [
    ['supplier_akyol', 'SUP-001', 'Akyol Çelik', 'Burak Akyol', 'Ankara', 18],
    ['supplier_ulusoy', 'SUP-002', 'Ulusoy Alüminyum', 'Esra Ulusoy', 'Ankara', 12],
    ['supplier_kuzey', 'SUP-003', 'Kuzey Yay', 'Mert Tan', 'İstanbul', 9],
    ['supplier_delta', 'SUP-004', 'Delta Polimer', 'Selin Yalçın', 'Bursa', 14],
    ['supplier_ates', 'SUP-005', 'Ateş Kaplama', 'Furkan Ateş', 'Kocaeli', 10],
    ['supplier_oztek', 'SUP-006', 'Öztek Fastener', 'Onur Öztek', 'İzmir', 7],
  ].map((row, index) => ({
    id: row[0],
    supplierCode: row[1],
    name: row[2],
    contactName: row[3],
    city: row[4],
    leadTimeDays: row[5],
    status: 'Aktif',
    createdAt: at(index),
    updatedAt: at(index, 10),
  }));

  const models = [
    ['model_art9_g2', 'ART9-G2', 'ART-9 Gen2 Tabanca', true],
    ['model_art9_tac', 'ART9-TAC', 'ART-9 Tactical Tabanca', true],
    ['model_art9_cmp', 'ART9-CMP', 'ART-9 Compact Tabanca', true],
    ['model_art9_trn', 'ART9-TRN', 'ART-9 Eğitim Kiti', false],
    ['model_art9_sd', 'ART9-SD', 'ART-9 Service Tabanca', true],
  ].map((row, index) => ({
    id: row[0],
    modelCode: row[1],
    modelName: row[2],
    description: `${row[2]} demo konfigürasyonu`,
    isActive: row[3],
    createdAt: at(index),
    updatedAt: at(index, 9),
  }));

  const rawDefs = [
    ['part_rm_4140_20', 'HAM-4140-020', '4140 Çelik Çubuk 20 mm', 'Çelik', '4140', 'Kg'],
    ['part_rm_4140_32', 'HAM-4140-032', '4140 Çelik Çubuk 32 mm', 'Çelik', '4140', 'Kg'],
    ['part_rm_42crmo4', 'HAM-42CRMO4-001', '42CrMo4 Dövme Taslak', 'Dövme Parça', '42CrMo4', 'Adet'],
    ['part_rm_174ph', 'HAM-174PH-016', '17-4PH Çubuk 16 mm', 'Çelik', '17-4PH', 'Kg'],
    ['part_rm_7075', 'HAM-7075-PLK', '7075 Alüminyum Plaka', 'Alüminyum', '7075-T651', 'Kg'],
    ['part_rm_6061', 'HAM-6061-PRF', '6061 Alüminyum Profil', 'Alüminyum', '6061-T6', 'Kg'],
    ['part_rm_pom', 'HAM-POM-ROD', 'POM Delrin Çubuk', 'Polimer', 'POM-C', 'Kg'],
    ['part_rm_pa6', 'HAM-PA6-GRN', 'PA6 Granül', 'Polimer', 'PA6', 'Kg'],
    ['part_rm_58sicr8', 'HAM-58SICR8-YAY', '58SiCr8 Yay Teli', 'Yay', '58SiCr8', 'Kg'],
    ['part_rm_edm', 'HAM-EDM-025', 'EDM Tel 0.25 mm', 'Diğer', 'CuZn37', 'Kg'],
    ['part_rm_304', 'HAM-304-SAC', '304 Paslanmaz Sac', 'Çelik', '304', 'Kg'],
    ['part_rm_ms58', 'HAM-MS58-012', 'MS58 Pirinç Çubuk', 'Diğer', 'CW614N', 'Kg'],
    ['part_rm_blackoxide', 'HAM-BLK-OX', 'Siyah Oksit Kimyasalı', 'Diğer', 'MIL-DTL-13924', 'Litre'],
    ['part_rm_phosphate', 'HAM-PHOS-01', 'Manganez Fosfat Banyosu', 'Diğer', 'MIL-DTL-16232', 'Litre'],
  ];

  const componentDefs = [
    ['part_frame_r', 'PAR-GOV-SAG-001', 'Gövde Sağ Yarım', 'Dövme Parça', '42CrMo4', 1],
    ['part_frame_l', 'PAR-GOV-SOL-001', 'Gövde Sol Yarım', 'Dövme Parça', '42CrMo4', 1],
    ['part_slide_std', 'PAR-SURG-001', 'Standart Sürgü', 'Parça', '4140', 1],
    ['part_slide_cmp', 'PAR-SURG-002', 'Kompakt Sürgü', 'Parça', '4140', 1],
    ['part_barrel_std', 'PAR-NAMLU-001', 'Standart Namlu 9x19', 'Parça', '4140', 1],
    ['part_barrel_tac', 'PAR-NAMLU-002', 'Dişli Namlu 9x19', 'Parça', '4140', 1],
    ['part_firing_pin', 'PAR-IGNE-001', 'Ateşleme İğnesi', 'Parça', '17-4PH', 1],
    ['part_firing_pin_spring', 'PAR-IGNE-YAY-001', 'Ateşleme İğne Yayı', 'Yay', '58SiCr8', 0],
    ['part_hammer', 'PAR-HOROZ-001', 'Horoz', 'Parça', '4140', 1],
    ['part_hammer_pin', 'PAR-HOROZ-PIM-001', 'Horoz Pimi', 'Pim', '17-4PH', 0],
    ['part_trigger', 'PAR-TETIK-001', 'Tetik', 'Parça', '4140', 0],
    ['part_trigger_bar', 'PAR-TETIK-KOL-001', 'Tetik Kolu', 'Parça', '4140', 0],
    ['part_trigger_pin', 'PAR-TETIK-PIM-001', 'Tetik Pimi', 'Pim', '17-4PH', 0],
    ['part_safety_lever', 'PAR-EMN-001', 'Emniyet Mandalı', 'Parça', '4140', 1],
    ['part_safety_spring', 'PAR-EMN-YAY-001', 'Emniyet Yayı', 'Yay', '58SiCr8', 0],
    ['part_mag_body', 'PAR-SARJOR-001', 'Şarjör Gövdesi', 'Sac Parça', '304', 0],
    ['part_mag_spring', 'PAR-SARJOR-YAY-001', 'Şarjör Yayı', 'Yay', '58SiCr8', 0],
    ['part_mag_base', 'PAR-SARJOR-TABAN-001', 'Şarjör Tabanı', 'Polimer', 'PA6', 0],
    ['part_mag_catch', 'PAR-SARJOR-KILIT-001', 'Şarjör Kilidi', 'Parça', '4140', 0],
    ['part_lock_block', 'PAR-KILIT-BLOGU-001', 'Kilit Bloğu', 'Parça', '4140', 1],
    ['part_rail_pin', 'PAR-KIZAK-PIM-001', 'Kızak Pimi', 'Pim', '17-4PH', 0],
    ['part_recoil_guide', 'PAR-IC-MIL-001', 'İcra Mili', 'Parça', '17-4PH', 0],
    ['part_recoil_spring', 'PAR-IC-YAY-001', 'İcra Yayı', 'Yay', '58SiCr8', 0],
    ['part_front_sight', 'PAR-ARPACIK-001', 'Arpacık', 'Parça', '4140', 0],
    ['part_rear_sight', 'PAR-GEZ-001', 'Gez', 'Parça', '4140', 0],
    ['part_grip_r', 'PAR-KABZA-SAG-001', 'Kabza Sağ Panel', 'Polimer', 'PA6 GF30', 0],
    ['part_grip_l', 'PAR-KABZA-SOL-001', 'Kabza Sol Panel', 'Polimer', 'PA6 GF30', 0],
    ['part_selector', 'PAR-SEL-001', 'Selektör Mandalı', 'Parça', '4140', 1],
    ['part_ejector', 'PAR-EJEKTOR-001', 'Ejektör', 'Parça', '4140', 1],
    ['part_extractor', 'PAR-EXTR-001', 'Extractor', 'Parça', '4140', 1],
    ['part_extractor_spring', 'PAR-EXTR-YAY-001', 'Extractor Yayı', 'Yay', '58SiCr8', 0],
    ['part_feed_insert', 'PAR-BESLEME-001', 'Besleme Rampası Inserti', 'Parça', '17-4PH', 1],
  ];

  const assemblyDefs = [
    ['part_assy_lower', 'ASM-ALT-GOVDE-001', 'Alt Gövde Montajı'],
    ['part_assy_slide', 'ASM-SURG-001', 'Sürgü Alt Grubu'],
    ['part_assy_trigger', 'ASM-TETIK-001', 'Tetik Mekanizması'],
    ['part_assy_mag', 'ASM-SARJOR-001', 'Şarjör Montajı'],
    ['part_assy_upper', 'ASM-UST-GRUP-001', 'Üst Gövde Alt Grubu'],
    ['part_assy_fire', 'ASM-ATES-KONTROL-001', 'Atış Kontrol Modülü'],
  ];

  const productDefs = [
    ['part_product_g2', 'PRD-ART9-G2', 'ART-9 Gen2 Tabanca'],
    ['part_product_tac', 'PRD-ART9-TAC', 'ART-9 Tactical Tabanca'],
    ['part_product_cmp', 'PRD-ART9-CMP', 'ART-9 Compact Tabanca'],
    ['part_product_trn', 'PRD-ART9-TRN', 'ART-9 Eğitim Kiti'],
    ['part_product_sd', 'PRD-ART9-SD', 'ART-9 Service Tabanca'],
  ];

  const usageDefs = {
    model_art9_g2: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_assy_trigger', 1], ['part_assy_mag', 2], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_grip_r', 1], ['part_grip_l', 1], ['part_product_g2', 1]],
    model_art9_tac: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_assy_mag', 3], ['part_barrel_tac', 1], ['part_selector', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_product_tac', 1]],
    model_art9_cmp: [['part_assy_lower', 1], ['part_slide_cmp', 1], ['part_assy_mag', 2], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_product_cmp', 1]],
    model_art9_trn: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_assy_mag', 2], ['part_feed_insert', 1], ['part_product_trn', 1]],
    model_art9_sd: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_assy_mag', 2], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_product_sd', 1]],
  };

  const productToModelMap = {
    part_product_g2: 'model_art9_g2',
    part_product_tac: 'model_art9_tac',
    part_product_cmp: 'model_art9_cmp',
    part_product_trn: 'model_art9_trn',
    part_product_sd: 'model_art9_sd',
  };

  const bomDefs = {
    part_assy_lower: [['part_frame_r', 1], ['part_frame_l', 1], ['part_trigger', 1], ['part_trigger_bar', 1], ['part_trigger_pin', 1], ['part_hammer', 1], ['part_hammer_pin', 1], ['part_safety_lever', 1], ['part_safety_spring', 1], ['part_ejector', 1], ['part_lock_block', 1]],
    part_assy_slide: [['part_slide_std', 1], ['part_extractor', 1], ['part_extractor_spring', 1], ['part_firing_pin', 1], ['part_firing_pin_spring', 1], ['part_front_sight', 1], ['part_rear_sight', 1]],
    part_assy_trigger: [['part_trigger', 1], ['part_trigger_bar', 1], ['part_hammer', 1], ['part_safety_lever', 1], ['part_safety_spring', 1]],
    part_assy_mag: [['part_mag_body', 1], ['part_mag_spring', 1], ['part_mag_base', 1], ['part_mag_catch', 1]],
    part_assy_upper: [['part_slide_std', 1], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1]],
    part_assy_fire: [['part_hammer', 1], ['part_trigger', 1], ['part_selector', 1], ['part_feed_insert', 1]],
    part_product_g2: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_assy_mag', 2], ['part_grip_r', 1], ['part_grip_l', 1]],
    part_product_tac: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_barrel_tac', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_assy_mag', 3], ['part_selector', 1]],
    part_product_cmp: [['part_assy_lower', 1], ['part_slide_cmp', 1], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_assy_mag', 2]],
    part_product_trn: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_assy_mag', 2], ['part_feed_insert', 1]],
    part_product_sd: [['part_assy_lower', 1], ['part_assy_slide', 1], ['part_barrel_std', 1], ['part_recoil_guide', 1], ['part_recoil_spring', 1], ['part_assy_mag', 2]],
  };

  const usageByPart = {};
  Object.entries(usageDefs).forEach(([modelId, rows]) => {
    const model = models.find((entry) => entry.id === modelId);
    rows.forEach(([partId, qtyPerUnit]) => {
      usageByPart[partId] = usageByPart[partId] || [];
      usageByPart[partId].push({ modelId, modelCode: model?.modelCode || '', modelName: model?.modelName || '', qtyPerUnit });
    });
  });

  const makePart = ({ id, partNumber, name, category, subCategory, material, unit, type, isAssembly, isCritical }, index) => {
    const currentStock = type === 'Raw Material' ? 48 + ((index % 7) * 16) : 18 + ((index % 9) * 6);
    const minStock = type === 'Product' ? 3 : type === 'Assembly' ? 4 : type === 'Raw Material' ? 18 : 8;
    return {
      id,
      partNumber,
      name,
      category,
      subCategory,
      material,
      materialStandard: material,
      unit,
      type,
      revision: 'A',
      revisionStatus: 'Aktif',
      isAssembly,
      isCritical,
      isForeignMilitary: false,
      isActive: true,
      currentStock,
      minStock,
      maxStock: minStock * 3,
      warehouseLocation: `${type === 'Raw Material' ? 'HAM' : type === 'Product' ? 'FG' : 'KMP'}-${String((index % 6) + 1).padStart(2, '0')}-${String((index % 4) + 1).padStart(2, '0')}`,
      stockStatus: stockStatus(currentStock, minStock),
      usedInModels: usageByPart[id] || [],
      upperTolerance: '+0.02',
      lowerTolerance: '-0.02',
      surfaceTreatment: type === 'Raw Material' ? 'Ham' : isCritical ? 'QPQ' : 'Standart',
      hardness: isCritical ? '36-40 HRC' : '28-32 HRC',
      weight: Number((0.12 + (index % 8) * 0.07).toFixed(2)),
      dimensions: `${20 + index} x ${10 + (index % 5)} x ${4 + (index % 3)} mm`,
      reorderPoint: minStock,
      reorderQty: minStock * 2,
      leadTimeDays: 7 + (index % 8),
      safetyStockDays: 14,
      avgDailyConsumption: Number((1 + (index % 4) * 0.5).toFixed(1)),
      createdAt: at(index % 9),
      updatedAt: at(index % 9, 10),
    };
  };

  const parts = [
    ...rawDefs.map((row, index) => makePart({ id: row[0], partNumber: row[1], name: row[2], category: 'Hammadde', subCategory: row[3], material: row[4], unit: row[5], type: 'Raw Material', isAssembly: false, isCritical: false }, index)),
    ...componentDefs.map((row, index) => makePart({ id: row[0], partNumber: row[1], name: row[2], category: 'Parça', subCategory: row[3], material: row[4], unit: 'Adet', type: 'Component', isAssembly: false, isCritical: Boolean(row[5]) }, index + 20)),
    ...assemblyDefs.map((row, index) => makePart({ id: row[0], partNumber: row[1], name: row[2], category: 'Montaj', subCategory: 'Montaj', material: 'Çoklu', unit: 'Adet', type: 'Assembly', isAssembly: true, isCritical: true }, index + 60)),
    ...productDefs.map((row, index) => makePart({ id: row[0], partNumber: row[1], name: row[2], category: 'Mamul', subCategory: 'Mamül', material: 'Çoklu', unit: 'Adet', type: 'Product', isAssembly: true, isCritical: true }, index + 80)),
  ];

  const partById = mapById(parts);
  const withComponents = parts.map((part) => ({
    ...part,
    components: (bomDefs[part.id] || []).map(([partId, qty]) => ({ partId, partNumber: partById[partId]?.partNumber || '', name: partById[partId]?.name || '', qty, unit: partById[partId]?.unit || 'Adet' })),
  }));
  const fullPartById = mapById(withComponents);

  const poItem = (partId, qty, unitPrice, deliveredQty = 0) => ({
    partId,
    partNumber: fullPartById[partId]?.partNumber || '',
    partName: fullPartById[partId]?.name || '',
    qty,
    orderedQty: qty,
    deliveredQty,
    remainingQty: qty - deliveredQty,
    unit: fullPartById[partId]?.unit || 'Adet',
    unitPrice,
    totalPrice: qty * unitPrice,
  });

  const supplierParts = [
    ['sp_001', 'supplier_akyol', 'part_rm_4140_20', 320, 'TRY', 18, true],
    ['sp_002', 'supplier_akyol', 'part_rm_4140_32', 345, 'TRY', 18, true],
    ['sp_003', 'supplier_akyol', 'part_rm_42crmo4', 585, 'TRY', 20, true],
    ['sp_004', 'supplier_ulusoy', 'part_rm_7075', 430, 'TRY', 12, true],
    ['sp_005', 'supplier_ulusoy', 'part_rm_6061', 295, 'TRY', 12, true],
    ['sp_006', 'supplier_delta', 'part_rm_pom', 210, 'TRY', 9, true],
    ['sp_007', 'supplier_delta', 'part_rm_pa6', 175, 'TRY', 9, true],
    ['sp_008', 'supplier_kuzey', 'part_mag_spring', 12.5, 'TRY', 7, true],
    ['sp_009', 'supplier_kuzey', 'part_recoil_spring', 18.2, 'TRY', 7, true],
    ['sp_010', 'supplier_kuzey', 'part_firing_pin_spring', 7.4, 'TRY', 7, true],
    ['sp_011', 'supplier_ates', 'part_barrel_std', 1240, 'TRY', 14, true],
    ['sp_012', 'supplier_ates', 'part_barrel_tac', 1380, 'TRY', 14, true],
    ['sp_013', 'supplier_delta', 'part_grip_r', 86, 'TRY', 10, true],
    ['sp_014', 'supplier_delta', 'part_grip_l', 86, 'TRY', 10, true],
    ['sp_015', 'supplier_oztek', 'part_front_sight', 64, 'TRY', 8, false],
    ['sp_016', 'supplier_oztek', 'part_rear_sight', 82, 'TRY', 8, false],
  ].map((row, index) => ({
    id: row[0],
    supplierId: row[1],
    supplierName: suppliers.find((item) => item.id === row[1])?.name || '',
    partId: row[2],
    partNumber: fullPartById[row[2]]?.partNumber || '',
    partName: fullPartById[row[2]]?.name || '',
    unitPrice: row[3],
    currency: row[4],
    leadTimeDays: row[5],
    isPreferred: row[6],
    createdAt: at(index),
    updatedAt: at(index, 11),
  }));

  const purchaseRequests = [
    ['pr_001', 'SAT-2026-0001', 'part_rm_4140_32', 120, 'Acil', 'Onaylandı', 'supplier_akyol', 345],
    ['pr_002', 'SAT-2026-0002', 'part_rm_7075', 80, 'Normal', 'Siparişe Dönüştü', 'supplier_ulusoy', 430],
    ['pr_003', 'SAT-2026-0003', 'part_mag_spring', 400, 'Kritik', 'Onaylandı', 'supplier_kuzey', 12.5],
    ['pr_004', 'SAT-2026-0004', 'part_grip_r', 150, 'Normal', 'Taslak', 'supplier_delta', 86],
    ['pr_005', 'SAT-2026-0005', 'part_barrel_tac', 40, 'Acil', 'Onaylandı', 'supplier_ates', 1380],
    ['pr_006', 'SAT-2026-0006', 'part_rm_pa6', 50, 'Normal', 'Reddedildi', 'supplier_delta', 175],
    ['pr_007', 'SAT-2026-0007', 'part_slide_std', 24, 'Acil', 'Siparişe Dönüştü', 'supplier_akyol', 1675],
    ['pr_008', 'SAT-2026-0008', 'part_recoil_spring', 240, 'Normal', 'Onaylandı', 'supplier_kuzey', 18.2],
  ].map((row, index) => ({
    id: row[0],
    prNumber: row[1],
    partId: row[2],
    partNumber: fullPartById[row[2]]?.partNumber || '',
    partName: fullPartById[row[2]]?.name || '',
    requestedQty: row[3],
    urgency: row[4],
    status: row[5],
    neededByDate: `2026-04-${String(10 + index).padStart(2, '0')}`,
    suggestedSupplierId: row[6],
    suggestedSupplierName: suppliers.find((item) => item.id === row[6])?.name || '',
    estimatedUnitPrice: row[7],
    currency: 'TRY',
    requestedBy: index % 2 === 0 ? 'Üretim Planlama' : 'Mühendislik',
    notes: 'Demo satınalma talebi.',
    linkedPoId: row[5] === 'Siparişe Dönüştü' ? index === 1 ? 'po_002' : 'po_003' : '',
    createdAt: at(10 + index),
    updatedAt: at(10 + index, 11),
  }));

  const purchaseOrders = [
    { id: 'po_001', poNumber: 'PO-2026-0001', supplierId: 'supplier_akyol', supplierName: 'Akyol Çelik', status: 'Tamamlandı', expectedDeliveryDate: '2026-03-21', items: [poItem('part_rm_4140_20', 140, 320, 140), poItem('part_rm_42crmo4', 60, 585, 60)] },
    { id: 'po_002', poNumber: 'PO-2026-0002', supplierId: 'supplier_ulusoy', supplierName: 'Ulusoy Alüminyum', status: 'Kısmi Teslim', expectedDeliveryDate: '2026-03-28', items: [poItem('part_rm_7075', 80, 430, 50), poItem('part_rm_6061', 60, 295, 60)] },
    { id: 'po_003', poNumber: 'PO-2026-0003', supplierId: 'supplier_akyol', supplierName: 'Akyol Çelik', status: 'Gönderildi', expectedDeliveryDate: '2026-04-08', items: [poItem('part_slide_std', 24, 1675), poItem('part_frame_r', 30, 1480), poItem('part_frame_l', 30, 1480)] },
    { id: 'po_004', poNumber: 'PO-2026-0004', supplierId: 'supplier_kuzey', supplierName: 'Kuzey Yay', status: 'Gönderildi', expectedDeliveryDate: '2026-04-04', items: [poItem('part_mag_spring', 400, 12.5), poItem('part_recoil_spring', 240, 18.2), poItem('part_firing_pin_spring', 300, 7.4)] },
    { id: 'po_005', poNumber: 'PO-2026-0005', supplierId: 'supplier_ates', supplierName: 'Ateş Kaplama', status: 'Tamamlandı', expectedDeliveryDate: '2026-03-16', items: [poItem('part_barrel_std', 45, 1240, 45), poItem('part_barrel_tac', 20, 1380, 20)] },
    { id: 'po_006', poNumber: 'PO-2026-0006', supplierId: 'supplier_delta', supplierName: 'Delta Polimer', status: 'Taslak', expectedDeliveryDate: '2026-04-15', items: [poItem('part_grip_r', 120, 86), poItem('part_grip_l', 120, 86)] },
  ].map((row, index) => ({
    ...row,
    currency: 'TRY',
    orderDate: `2026-03-${String(8 + index * 2).padStart(2, '0')}`,
    paymentTerms: index % 2 === 0 ? '30 Gün' : '45 Gün',
    totalAmount: row.items.reduce((sum, item) => sum + item.totalPrice, 0),
    notes: 'Demo PO kaydı',
    createdAt: at(7 + index),
    updatedAt: at(24 + (index % 3), 10),
  }));

  const asn = [
    ['asn_001', 'ASN-2026-0001', 'po_003', 'PO-2026-0003', 'Akyol Çelik', 'Yolda', '2026-04-07'],
    ['asn_002', 'ASN-2026-0002', 'po_004', 'PO-2026-0004', 'Kuzey Yay', 'Yolda', '2026-04-06'],
  ].map((row, index) => ({
    id: row[0],
    asnNumber: row[1],
    poId: row[2],
    poNumber: row[3],
    supplierName: row[4],
    status: row[5],
    etaDate: row[6],
    createdAt: at(26 + index),
    updatedAt: at(26 + index, 11),
  }));

  const rfq = [
    ['rfq_001', 'RFQ-2026-0001', 'part_barrel_tac', 40, 'Teklif Toplanıyor', '2026-04-09'],
    ['rfq_002', 'RFQ-2026-0002', 'part_grip_r', 120, 'Teklif Alındı', '2026-04-12'],
  ].map((row, index) => ({
    id: row[0],
    rfqNumber: row[1],
    partId: row[2],
    partNumber: fullPartById[row[2]]?.partNumber || '',
    partName: fullPartById[row[2]]?.name || '',
    requestedQty: row[3],
    status: row[4],
    dueDate: row[5],
    createdAt: at(18 + index),
    updatedAt: at(18 + index, 12),
  }));

  const goodsReceipts = [
    ['grn_001', 'GRN-2026-0001', 'po_001', 'PO-2026-0001', 'Akyol Çelik', 'Stoka Alındı', [['part_rm_4140_20', 140, 0, 'LOT-2026-03-001', 'HAM-A01-01', false], ['part_rm_42crmo4', 60, 0, 'LOT-2026-03-002', 'HAM-A01-03', true]]],
    ['grn_002', 'GRN-2026-0002', 'po_002', 'PO-2026-0002', 'Ulusoy Alüminyum', 'QC Bekliyor', [['part_rm_7075', 50, 0, 'LOT-2026-03-003', 'HAM-A02-01', true], ['part_rm_6061', 60, 0, 'LOT-2026-03-004', 'HAM-A02-02', false]]],
    ['grn_003', 'GRN-2026-0003', 'po_005', 'PO-2026-0005', 'Ateş Kaplama', 'Stoka Alındı', [['part_barrel_std', 45, 0, 'LOT-2026-03-005', 'KMP-B03-01', true], ['part_barrel_tac', 20, 0, 'LOT-2026-03-006', 'KMP-B03-02', true]]],
    ['grn_004', 'GRN-2026-0004', 'po_004', 'PO-2026-0004', 'Kuzey Yay', 'Kısmi Kabul', [['part_mag_spring', 180, 20, 'LOT-2026-04-001', 'KMP-B08-02', true], ['part_recoil_spring', 140, 0, 'LOT-2026-04-002', 'KMP-B10-02', true]]],
  ].map((row, index) => ({
    id: row[0],
    grnNumber: row[1],
    receiptNo: row[1],
    poId: row[2],
    poNumber: row[3],
    supplierName: row[4],
    receivedBy: index % 2 === 0 ? 'Can Depo' : 'Ayşe Kalite',
    receivedDate: `2026-03-${String(16 + index * 4).padStart(2, '0')}`,
    status: row[5],
    items: row[6].map((item) => ({
      partId: item[0],
      partNumber: fullPartById[item[0]]?.partNumber || '',
      partName: fullPartById[item[0]]?.name || '',
      orderedQty: item[1] + item[2],
      receivedQty: item[1],
      rejectedQty: item[2],
      unit: fullPartById[item[0]]?.unit || 'Adet',
      lotNumber: item[3],
      warehouseLocation: item[4],
      location: item[4],
      qcRequired: item[5],
    })),
    createdAt: at(20 + index),
    updatedAt: at(20 + index, 14),
  }));

  const inventoryBatches = [
    ['batch_001', 'LOT-2026-03-001', 'part_rm_4140_20', 140, 96, 'Sağlam', 'HAM-A01-01', 'po_001', 'Akyol Çelik'],
    ['batch_002', 'LOT-2026-03-002', 'part_rm_42crmo4', 60, 38, 'Karantina', 'HAM-A01-03', 'po_001', 'Akyol Çelik'],
    ['batch_003', 'LOT-2026-03-003', 'part_rm_7075', 50, 42, 'Karantina', 'HAM-A02-01', 'po_002', 'Ulusoy Alüminyum'],
    ['batch_004', 'LOT-2026-03-004', 'part_rm_6061', 60, 48, 'Sağlam', 'HAM-A02-02', 'po_002', 'Ulusoy Alüminyum'],
    ['batch_005', 'LOT-2026-03-005', 'part_barrel_std', 45, 26, 'Sağlam', 'KMP-B03-01', 'po_005', 'Ateş Kaplama'],
    ['batch_006', 'LOT-2026-03-006', 'part_barrel_tac', 20, 12, 'Sağlam', 'KMP-B03-02', 'po_005', 'Ateş Kaplama'],
    ['batch_007', 'LOT-2026-04-001', 'part_mag_spring', 180, 180, 'Karantina', 'KMP-B08-02', 'po_004', 'Kuzey Yay'],
    ['batch_008', 'LOT-2026-04-002', 'part_recoil_spring', 140, 140, 'Karantina', 'KMP-B10-02', 'po_004', 'Kuzey Yay'],
    ['batch_009', 'LOT-2026-02-001', 'part_frame_r', 36, 20, 'Sağlam', 'KMP-B01-01', 'legacy', 'Akyol Çelik'],
    ['batch_010', 'LOT-2026-02-002', 'part_frame_l', 36, 20, 'Sağlam', 'KMP-B01-02', 'legacy', 'Akyol Çelik'],
    ['batch_011', 'LOT-2026-02-003', 'part_slide_std', 22, 12, 'Sağlam', 'KMP-B02-01', 'legacy', 'Akyol Çelik'],
    ['batch_012', 'LOT-2026-02-004', 'part_mag_body', 80, 55, 'Sağlam', 'KMP-B08-01', 'legacy', 'Öztek Fastener'],
  ].map((row, index) => ({
    id: row[0],
    batchId: row[1],
    lotNumber: row[1],
    partId: row[2],
    partNumber: fullPartById[row[2]]?.partNumber || '',
    quantity: row[3],
    remainingQty: row[4],
    status: row[5],
    qcStatus: row[5],
    warehouseLocation: row[6],
    location: row[6],
    poId: row[7],
    poNumber: row[7] === 'legacy' ? 'PO-2026-0000' : purchaseOrders.find((item) => item.id === row[7])?.poNumber || '',
    grnNumber: row[7] === 'legacy' ? 'PO-2026-0000' : purchaseOrders.find((item) => item.id === row[7])?.poNumber || '',
    supplierName: row[8],
    receivedDate: at(14 + index),
    entryDate: at(14 + index),
    createdAt: at(14 + index),
    updatedAt: at(25 + (index % 4), 10),
  }));

  const stockMovements = [
    ['move_001', 'part_rm_4140_20', 'LOT-2026-03-001', 140, 'Satınalma Girişi', 'GRN-2026-0001', '', 'HAM-A01-01'],
    ['move_002', 'part_rm_42crmo4', 'LOT-2026-03-002', 60, 'Satınalma Girişi', 'GRN-2026-0001', '', 'HAM-A01-03'],
    ['move_003', 'part_rm_7075', 'LOT-2026-03-003', 50, 'Satınalma Girişi', 'GRN-2026-0002', '', 'HAM-A02-01'],
    ['move_004', 'part_rm_6061', 'LOT-2026-03-004', 60, 'Satınalma Girişi', 'GRN-2026-0002', '', 'HAM-A02-02'],
    ['move_005', 'part_barrel_std', 'LOT-2026-03-005', 45, 'Satınalma Girişi', 'GRN-2026-0003', '', 'KMP-B03-01'],
    ['move_006', 'part_mag_spring', 'LOT-2026-04-001', 180, 'Satınalma Girişi', 'GRN-2026-0004', '', 'KMP-B08-02'],
    ['move_007', 'part_rm_4140_20', 'LOT-2026-03-001', -44, 'İş Emri Çıkışı', 'WO-2026-002', 'HAM-A01-01', 'CNC-01'],
    ['move_008', 'part_frame_r', 'LOT-2026-02-001', -8, 'İş Emri Çıkışı', 'WO-2026-002', 'KMP-B01-01', 'MNT-01'],
    ['move_009', 'part_frame_l', 'LOT-2026-02-002', -8, 'İş Emri Çıkışı', 'WO-2026-002', 'KMP-B01-02', 'MNT-01'],
    ['move_010', 'part_slide_std', 'LOT-2026-02-003', -6, 'İş Emri Çıkışı', 'WO-2026-003', 'KMP-B02-01', 'MNT-02'],
    ['move_011', 'part_barrel_std', 'LOT-2026-03-005', -8, 'İş Emri Çıkışı', 'WO-2026-003', 'KMP-B03-01', 'MNT-02'],
    ['move_012', 'part_product_g2', 'LOT-FG-001', 12, 'Üretim Girişi', 'WO-2026-004', 'MNT-03', 'FG-D01-01'],
    ['move_013', 'part_product_tac', 'LOT-FG-002', 6, 'Üretim Girişi', 'WO-2026-003', 'MNT-03', 'FG-D01-02'],
    ['move_014', 'part_product_g2', 'LOT-FG-001', -4, 'Sevkiyat', 'SHP-2026-0001', 'FG-D01-01', 'Müşteri'],
    ['move_015', 'part_product_cmp', 'LOT-FG-003', -2, 'Sevkiyat', 'SHP-2026-0002', 'FG-D01-03', 'Müşteri'],
  ].map((row, index) => ({
    id: row[0],
    partId: row[1],
    partNumber: fullPartById[row[1]]?.partNumber || '',
    lotNumber: row[2],
    batchId: row[2],
    qty: row[3],
    quantity: row[3],
    movementType: row[4],
    type: row[4],
    reference: row[5],
    referenceNumber: row[5],
    fromLocation: row[6],
    toLocation: row[7],
    notes: `${row[4]} - ${row[5]}`,
    performedBy: currentUserName,
    timestamp: at(20 + index),
    createdAt: at(20 + index),
    updatedAt: at(20 + index),
  }));

  const inspectionPlans = [
    ['ip_001', 'part_barrel_std', 'IP-ART-NAMLU-001', 'Giriş Kalite'],
    ['ip_002', 'part_barrel_tac', 'IP-ART-NAMLU-002', 'Giriş Kalite'],
    ['ip_003', 'part_slide_std', 'IP-ART-SURG-001', 'Proses'],
    ['ip_004', 'part_frame_r', 'IP-ART-GOV-001', 'Proses'],
    ['ip_005', 'part_frame_l', 'IP-ART-GOV-002', 'Proses'],
    ['ip_006', 'part_mag_body', 'IP-ART-SARJOR-001', 'Giriş Kalite'],
    ['ip_007', 'part_product_g2', 'IP-ART-FINAL-001', 'Final'],
    ['ip_008', 'part_product_tac', 'IP-ART-FINAL-002', 'Final'],
  ].map((row, index) => ({
    id: row[0],
    partId: row[1],
    partNumber: fullPartById[row[1]]?.partNumber || '',
    partName: fullPartById[row[1]]?.name || '',
    planNumber: row[2],
    inspectionType: row[3],
    tolerance: '+/- 0.02 mm',
    measurementMethod: 'CMM / görsel kontrol / fonksiyon testi',
    status: 'Aktif',
    createdAt: at(12 + index),
    updatedAt: at(12 + index, 9),
  }));

  const qcInspections = [
    ['qc_001', 'QC-2026-0001', 'Giriş Kalite', 'part_barrel_std', 'LOT-2026-03-005', '', 'Kabul', 'Ayşe Kalite'],
    ['qc_002', 'QC-2026-0002', 'Giriş Kalite', 'part_barrel_tac', 'LOT-2026-03-006', '', 'Şartlı Kabul', 'Ayşe Kalite'],
    ['qc_003', 'QC-2026-0003', 'Proses', 'part_slide_std', '', 'WO-2026-002', 'Kabul', 'Emre Kalite'],
    ['qc_004', 'QC-2026-0004', 'Final', 'part_product_g2', 'LOT-FG-001', 'WO-2026-004', 'Kabul', 'Ayşe Kalite'],
    ['qc_005', 'QC-2026-0005', 'Final', 'part_product_tac', 'LOT-FG-002', 'WO-2026-003', 'Red', 'Emre Kalite'],
    ['qc_006', 'QC-2026-0006', 'Giriş Kalite', 'part_rm_42crmo4', 'LOT-2026-03-002', '', 'Kabul', 'Ayşe Kalite'],
  ].map((row, index) => ({
    id: row[0],
    inspectionNo: row[1],
    inspectionType: row[2],
    partId: row[3],
    lotNumber: row[4],
    batchId: row[4],
    workOrderNo: row[5],
    workOrderId: row[5] ? (row[5] === 'WO-2026-002' ? 'wo_002' : row[5] === 'WO-2026-003' ? 'wo_003' : 'wo_004') : '',
    overallResult: row[6],
    inspectorName: row[7],
    createdAt: at(16 + index),
    inspectionDate: at(16 + index),
  }));

  const ncrRecords = [
    ['ncr_001', 'NCR-2026-0001', 'part_product_tac', 'Final testte sürgü geriye kilitlenmedi', 'Açık', 'rework'],
    ['ncr_002', 'NCR-2026-0002', 'part_mag_spring', 'Şarjör yayında serbest boy sapması', 'İncelemede', 'scrap'],
    ['ncr_003', 'NCR-2026-0003', 'part_barrel_tac', 'Dişli namluda kaplama ton farkı', 'Kapalı', 'accept'],
  ].map((row, index) => ({
    id: row[0],
    ncrNumber: row[1],
    partId: row[2],
    partNumber: fullPartById[row[2]]?.partNumber || '',
    title: row[3],
    description: row[3],
    status: row[4],
    action: row[5],
    disposition: row[5],
    sourceType: index === 0 ? 'Final Kontrol' : 'Giriş Kalite',
    createdAt: at(30 + index),
    updatedAt: at(30 + index, 10),
  }));

  const workCenters = [
    ['wc_turning', 'WC-TRN-01', 'CNC Torna Hücresi', 'CNC', 'Müsait'],
    ['wc_milling', 'WC-FRZ-01', 'CNC Freze Hücresi', 'CNC', 'Dolu'],
    ['wc_heat', 'WC-HT-01', 'Isıl İşlem', 'Isıl İşlem', 'Müsait'],
    ['wc_assembly', 'WC-MNT-01', 'Nihai Montaj', 'Montaj', 'Dolu'],
    ['wc_test', 'WC-TST-01', 'Fonksiyon Testi', 'Test', 'Müsait'],
  ].map((row, index) => ({
    id: row[0],
    code: row[1],
    name: row[2],
    type: row[3],
    status: row[4],
    capacityPerShift: 32 + index * 4,
    createdAt: at(2 + index),
    updatedAt: at(22 + index, 8),
  }));

  const machines = [
    ['machine_001', 'MCH-TRN-01', 'Okuma LB3000', 'wc_turning', 'Aktif'],
    ['machine_002', 'MCH-FRZ-01', 'Makino a61nx', 'wc_milling', 'Aktif'],
    ['machine_003', 'MCH-HT-01', 'Vakum Fırın', 'wc_heat', 'Planlı Bakım'],
    ['machine_004', 'MCH-MNT-01', 'Montaj İstasyonu 1', 'wc_assembly', 'Aktif'],
  ].map((row, index) => ({
    id: row[0],
    machineCode: row[1],
    name: row[2],
    workCenterId: row[3],
    status: row[4],
    createdAt: at(6 + index),
    updatedAt: at(24 + index, 8),
  }));

  const workOrders = [
    ['wo_001', 'WO-2026-001', 'part_product_g2', 'model_art9_g2', 24, 'Onaylı', 'Normal'],
    ['wo_002', 'WO-2026-002', 'part_product_g2', 'model_art9_g2', 16, 'Üretimde', 'Yüksek'],
    ['wo_003', 'WO-2026-003', 'part_product_tac', 'model_art9_tac', 8, 'Kalitede', 'Acil'],
    ['wo_004', 'WO-2026-004', 'part_product_g2', 'model_art9_g2', 12, 'Tamamlandı', 'Normal'],
    ['wo_005', 'WO-2026-005', 'part_product_cmp', 'model_art9_cmp', 10, 'Taslak', 'Normal'],
    ['wo_006', 'WO-2026-006', 'part_product_trn', 'model_art9_trn', 6, 'İptal', 'Normal'],
  ].map((row, index) => ({
    id: row[0],
    woNumber: row[1],
    productId: row[2],
    productPartId: row[2],
    productNumber: fullPartById[row[2]]?.partNumber || '',
    productPartNumber: fullPartById[row[2]]?.partNumber || '',
    productName: fullPartById[row[2]]?.name || '',
    modelId: row[3],
    modelCode: models.find((item) => item.id === row[3])?.modelCode || '',
    quantity: row[4],
    unit: 'Adet',
    type: index === 4 ? 'Prototip' : 'Seri Üretim',
    status: row[5],
    priority: row[6],
    plannedStart: `2026-04-${String(3 + index).padStart(2, '0')}`,
    plannedEnd: `2026-04-${String(8 + index).padStart(2, '0')}`,
    assignedEngineerName: 'Mehmet Poyraz',
    operatorName: ['Ali Operatör', 'Berk Operatör', 'Murat Operatör'][index % 3],
    notes: 'Demo iş emri.',
    components: (bomDefs[row[2]] || []).map(([partId, qty]) => ({ partId, partNumber: fullPartById[partId]?.partNumber || '', name: fullPartById[partId]?.name || '', qty, unit: fullPartById[partId]?.unit || 'Adet' })),
    operations: [
      { step: 1, name: 'Alt Gövde Montajı', workCenterId: 'wc_assembly', status: index > 0 ? 'Bitti' : 'Hazırlık', completedAt: index > 0 ? at(26 + index) : '' },
      { step: 2, name: 'Sürgü Alt Grup Montajı', workCenterId: 'wc_assembly', status: index === 1 ? 'Üretimde' : index > 1 ? 'Bitti' : 'Beklemede', completedAt: index > 1 ? at(27 + index) : '' },
      { step: 3, name: 'Final Birleştirme', workCenterId: 'wc_assembly', status: index > 2 ? 'Bitti' : 'Beklemede', completedAt: index > 2 ? at(28 + index) : '' },
      { step: 4, name: 'Fonksiyon Testi', workCenterId: 'wc_test', status: index > 2 ? 'Bitti' : 'Beklemede', completedAt: index > 2 ? at(29 + index) : '' },
    ],
    createdBy: currentUserName,
    createdAt: at(18 + index),
    updatedAt: at(30 + index, 10),
  }));

  const workLogs = [
    ['worklog_001', 'wo_002', 'Alt Gövde Montajı', 3.2, 'Berk Operatör'],
    ['worklog_002', 'wo_002', 'Sürgü Alt Grup Montajı', 2.1, 'Berk Operatör'],
    ['worklog_003', 'wo_003', 'Alt Gövde Montajı', 1.9, 'Murat Operatör'],
    ['worklog_004', 'wo_003', 'Sürgü Alt Grup Montajı', 1.6, 'Murat Operatör'],
    ['worklog_005', 'wo_004', 'Final Birleştirme', 1.7, 'Ali Operatör'],
  ].map((row, index) => ({
    id: row[0],
    workOrderId: row[1],
    operationName: row[2],
    durationHours: row[3],
    operator: row[4],
    timestamp: at(27 + index),
    createdAt: at(27 + index),
    updatedAt: at(27 + index),
  }));

  const documents = [
    ['doc_001', 'TR-ART9-001', 'Alt Gövde Teknik Resmi', 'Teknik Resim', 'part_assy_lower', 'Onaylandı'],
    ['doc_002', 'TR-ART9-002', 'Sürgü Alt Grup Teknik Resmi', 'Teknik Resim', 'part_assy_slide', 'Onaylandı'],
    ['doc_003', 'TR-ART9-003', 'Namlu İşleme Talimatı', 'Talimat', 'part_barrel_std', 'Onaylandı'],
    ['doc_004', 'TR-ART9-004', 'Dişli Namlu Kontrol Planı', 'Kalite Planı', 'part_barrel_tac', 'İncelemede'],
    ['doc_005', 'TR-ART9-005', 'Şarjör Montaj Talimatı', 'Talimat', 'part_assy_mag', 'Onaylandı'],
    ['doc_006', 'TR-ART9-006', 'Final Test Prosedürü', 'Prosedür', 'part_product_g2', 'Onaylandı'],
    ['doc_007', 'TR-ART9-007', 'Kompakt Teknik Paket', 'Teknik Resim', 'part_product_cmp', 'Taslak'],
    ['doc_008', 'TR-ART9-008', 'Lot İzlenebilirlik Formu', 'Form', '', 'Onaylandı'],
  ].map((row, index) => ({
    id: row[0],
    docNumber: row[1],
    title: row[2],
    category: row[3],
    linkedPartId: row[4],
    linkedPartNumber: row[4] ? fullPartById[row[4]]?.partNumber || '' : '',
    revision: 'A',
    revisionStatus: row[5],
    description: 'Demo dokümanı.',
    fileName: `${row[1]}.pdf`,
    uploadedBy: currentUserName,
    updatedBy: currentUserName,
    createdAt: at(8 + index),
    updatedAt: at(8 + index, 12),
  }));

  const customers = [
    ['customer_001', 'CUS-001', 'Kara Sistemleri Başkanlığı', 'Mustafa Demir', 'Türkiye'],
    ['customer_002', 'CUS-002', 'Anka Savunma Tedarik', 'Pelin Acar', 'Türkiye'],
    ['customer_003', 'CUS-003', 'Nordic Defense Trading', 'Lars Holm', 'İsveç'],
    ['customer_004', 'CUS-004', 'Atlas Tactical Systems', 'Jason Reed', 'ABD'],
  ].map((row, index) => ({
    id: row[0],
    customerNumber: row[1],
    name: row[2],
    contactPerson: row[3],
    country: row[4],
    status: 'Aktif',
    createdAt: at(9 + index),
    updatedAt: at(26 + index, 9),
  }));

  const salesOrders = [
    ['sales_order_001', 'SO-2026-0001', 'customer_001', 'part_product_g2', 12, 3850, 'USD', 'Ready for Shipping'],
    ['sales_order_002', 'SO-2026-0002', 'customer_002', 'part_product_tac', 8, 4220, 'USD', 'In Production'],
    ['sales_order_003', 'SO-2026-0003', 'customer_003', 'part_product_cmp', 6, 3390, 'EUR', 'Confirmed'],
    ['sales_order_004', 'SO-2026-0004', 'customer_004', 'part_product_g2', 4, 3925, 'USD', 'Shipped'],
    ['sales_order_005', 'SO-2026-0005', 'customer_002', 'part_product_sd', 15, 3610, 'USD', 'Confirmed'],
  ].map((row, index) => ({
    id: row[0],
    soNumber: row[1],
    customerId: row[2],
    customerName: customers.find((item) => item.id === row[2])?.name || '',
    productPartId: row[3],
    productPartNumber: fullPartById[row[3]]?.partNumber || '',
    productName: fullPartById[row[3]]?.name || '',
    quantity: row[4],
    unitPrice: row[5],
    currency: row[6],
    status: row[7],
    requestedDate: `2026-04-${String(10 + index * 3).padStart(2, '0')}`,
    workOrderId: index === 1 ? 'WO-2026-003' : '',
    createdAt: at(24 + index),
    updatedAt: at(24 + index, 11),
  }));

  const shipments = [
    ['shipment_001', 'SHP-2026-0001', 'sales_order_004', 'Atlas Tactical Systems', 'Shipped', [['part_product_g2', 4]]],
    ['shipment_002', 'SHP-2026-0002', 'sales_order_001', 'Kara Sistemleri Başkanlığı', 'Hazırlanıyor', [['part_product_g2', 8]]],
  ].map((row, index) => ({
    id: row[0],
    shipmentNo: row[1],
    salesOrderId: row[2],
    customerName: row[3],
    status: row[4],
    shipmentDate: `2026-04-${String(4 + index * 6).padStart(2, '0')}`,
    items: row[5].map(([partId, qty]) => ({ partId, partNumber: fullPartById[partId]?.partNumber || '', qty })),
    createdAt: at(34 + index),
    updatedAt: at(34 + index),
  }));

  const cycleCounts = [
    ['cc_001', 'CC-2026-0001', 'HAM-A01-01', 'Tamamlandı', 1],
    ['cc_002', 'CC-2026-0002', 'FG-D01-01', 'Açık', 0],
  ].map((row, index) => ({
    id: row[0],
    countNumber: row[1],
    location: row[2],
    status: row[3],
    discrepancyCount: row[4],
    countedBy: 'Can Depo',
    createdAt: at(30 + index),
    updatedAt: at(30 + index, 12),
  }));

  const measuringTools = [
    ['tool_001', 'MT-001', 'Dijital Kumpas 0-150', 'Aktif'],
    ['tool_002', 'MT-002', 'İç Çap Mikrometresi', 'Aktif'],
    ['tool_003', 'MT-003', 'CMM Prob Seti', 'Süresi Dolmuş'],
    ['tool_004', 'MT-004', 'Tetik Kuvvet Ölçer', 'Süresi Dolmuş'],
  ].map((row, index) => ({
    id: row[0],
    toolNumber: row[1],
    name: row[2],
    status: row[3],
    calibrationDueDate: `2026-0${index + 3}-01`,
    createdAt: at(5 + index),
    updatedAt: at(31 + index),
  }));

  const salesInvoices = [
    ['invoice_001', 'INV-2026-0001', 'sales_order_004', 'Atlas Tactical Systems', 15700, 'USD', 'Kesildi'],
    ['invoice_002', 'INV-2026-0002', 'sales_order_001', 'Kara Sistemleri Başkanlığı', 46200, 'USD', 'Taslak'],
  ].map((row, index) => ({
    id: row[0],
    invoiceNumber: row[1],
    salesOrderId: row[2],
    customerName: row[3],
    totalAmount: row[4],
    currency: row[5],
    status: row[6],
    createdAt: at(34 + index, 12),
    updatedAt: at(34 + index, 12),
  }));

  const priceHistory = [
    ['ph_001', 'part_rm_4140_20', 'supplier_akyol', 305],
    ['ph_002', 'part_rm_4140_20', 'supplier_akyol', 320],
    ['ph_003', 'part_barrel_std', 'supplier_ates', 1180],
    ['ph_004', 'part_barrel_std', 'supplier_ates', 1240],
    ['ph_005', 'part_mag_spring', 'supplier_kuzey', 11.4],
    ['ph_006', 'part_mag_spring', 'supplier_kuzey', 12.5],
  ].map((row, index) => ({
    id: row[0],
    partId: row[1],
    partNumber: fullPartById[row[1]]?.partNumber || '',
    supplierId: row[2],
    supplierName: suppliers.find((item) => item.id === row[2])?.name || '',
    unitPrice: row[3],
    currency: 'TRY',
    createdAt: at(2 + index),
    updatedAt: at(2 + index),
  }));

  const logs = [
    ['log_001', 'purchase_request_approved', 'Purchase Request', 'pr_001'],
    ['log_002', 'purchase_order_sent', 'Purchase Order', 'po_003'],
    ['log_003', 'goods_receipt_completed', 'Goods Receipt', 'grn_001'],
    ['log_004', 'incoming_qc_completed', 'QC Inspection', 'qc_001'],
    ['log_005', 'ncr_opened', 'NCR', 'ncr_001'],
    ['log_006', 'shipment_created', 'Shipment', 'shipment_001'],
  ].map((row, index) => ({
    id: row[0],
    action: row[1],
    entityType: row[2],
    entityId: row[3],
    user_id: currentUserEmail,
    userName: currentUserName,
    timestamp: at(20 + index),
    createdAt: at(20 + index),
    updatedAt: at(20 + index),
  }));

  const batch = writeBatch(db);
  const writeDocs = (collectionName, rows) => rows.forEach(({ id, ...data }) => batch.set(doc(db, collectionName, id), data, { merge: true }));

  writeDocs('suppliers', suppliers);
  writeDocs('models', models);
  writeDocs('parts', withComponents);
  writeDocs('purchase_requests', purchaseRequests);
  writeDocs('purchase_orders', purchaseOrders);
  writeDocs('goods_receipts', goodsReceipts);
  writeDocs('inventory_lots', inventoryBatches);
  writeDocs('stock_movements', stockMovements);
  writeDocs('quality_plans', inspectionPlans);
  writeDocs('quality_records', qcInspections);
  writeDocs('nonconformities', ncrRecords);
  writeDocs('production_orders', workOrders);
  writeDocs('production_logs', workLogs);
  writeDocs('customers', customers);
  writeDocs('sales_orders', salesOrders);
  writeDocs('shipments', shipments);

  const summary = {
    version: 'demo-v1',
    parts: withComponents.length,
    models: models.length,
    suppliers: suppliers.length,
    purchaseOrders: purchaseOrders.length,
    inventoryBatches: inventoryBatches.length,
    qcInspections: qcInspections.length,
    workOrders: workOrders.length,
    salesOrders: salesOrders.length,
    sampleLotNumbers: ['LOT-2026-03-001', 'LOT-2026-03-005', 'LOT-2026-04-001'],
    samplePurchaseOrder: 'PO-2026-0003',
    sampleWorkOrder: 'WO-2026-003',
    sampleSalesOrder: 'SO-2026-0002',
    updatedBy: currentUserName,
    updatedAt: at(35, 14),
  };

  await batch.commit();
  return summary;
}


