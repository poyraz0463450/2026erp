import {
  addData,
  addPurchaseRequest,
  addWorkOrder,
  getModels,
  getParts,
  getPurchaseOrders,
  getPurchaseRequests,
  getSupplierParts,
  getWorkCenters,
  getWorkOrders,
} from '../firebase/firestore';
import { generateWorkOrderNumber } from '../utils/autoGen';
import { analyzeMaterialPlanning, resolveSupplyChannel } from './materialPlanningCore';

const toRows = (snapshot) => snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
const numberValue = (value) => Number(value || 0);
const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const addDays = (dateText, days) => {
  const date = new Date(`${dateText}T08:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const createAutoPRNumber = () => {
  const year = new Date().getFullYear();
  return `PR-${year}-AUTO-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 10)}`;
};

const queueAlert = async ({ partNumber, partName, netNeed, actorName, actorEmail, target }) => {
  const createdAt = new Date().toISOString();
  const message = `${partNumber} - ${partName} için kritik stok alarmı. Eksik miktar: ${netNeed}.`;

  await Promise.all([
    addData('logs', {
      user_id: actorEmail,
      action: 'critical_stock_alert',
      target,
      message,
      partNumber,
      qty: netNeed,
      created_at: createdAt,
      createdAt,
    }),
    addData('mail_queue', {
      to: 'purchasing@artegon.local',
      cc: actorEmail,
      subject: `[KRİTİK STOK] ${partNumber}`,
      body: `${message} Lütfen satın alma panelinden aksiyon alın.`,
      status: 'queued',
      module: 'material_planning',
      createdBy: actorName,
      createdAt,
    }),
  ]);
};

const buildDefaultOperations = (centers = []) => {
  const findCenter = (...keywords) =>
    centers.find((center) =>
      keywords.some((keyword) =>
        `${center.name || ''} ${center.type || ''} ${center.code || ''}`.toLowerCase().includes(keyword)
      )
    )?.id || '';

  return [
    { step: 1, name: 'Malzeme Hazırlık', workCenterId: findCenter('işleme', 'torna', 'vmc'), status: 'Beklemede', manualHours: 1.5 },
    { step: 2, name: 'İşleme / Üretim', workCenterId: findCenter('vmc', 'hmc', 'torna', 'pres', 'enjeksiyon'), status: 'Beklemede', manualHours: 4 },
    { step: 3, name: 'Ara Kontrol', workCenterId: findCenter('kalite', 'qc'), status: 'Beklemede', manualHours: 0.75 },
    { step: 4, name: 'Montaj / Final Hazırlık', workCenterId: findCenter('montaj', 'assy'), status: 'Beklemede', manualHours: 1.5 },
    { step: 5, name: 'Final Kalite', workCenterId: findCenter('kalite', 'qc'), status: 'Beklemede', manualHours: 0.75 },
  ];
};

export { analyzeMaterialPlanning, resolveSupplyChannel };

export async function loadMaterialPlanningSnapshot() {
  const [partsSnap, purchaseRequestSnap, purchaseOrderSnap, workOrderSnap, supplierPartSnap, modelSnap] = await Promise.all([
    getParts(),
    getPurchaseRequests(),
    getPurchaseOrders(),
    getWorkOrders(),
    getSupplierParts(),
    getModels(),
  ]);

  return analyzeMaterialPlanning({
    parts: toRows(partsSnap),
    purchaseRequests: toRows(purchaseRequestSnap),
    purchaseOrders: toRows(purchaseOrderSnap),
    workOrders: toRows(workOrderSnap),
    supplierParts: toRows(supplierPartSnap),
    models: toRows(modelSnap),
  });
}

export async function syncMaterialPlanning({
  actorName = 'Sistem',
  actorEmail = 'system@artegon.local',
} = {}) {
  const [partsSnap, purchaseRequestSnap, purchaseOrderSnap, workOrderSnap, supplierPartSnap, modelSnap, workCenterSnap] = await Promise.all([
    getParts(),
    getPurchaseRequests(),
    getPurchaseOrders(),
    getWorkOrders(),
    getSupplierParts(),
    getModels(),
    getWorkCenters(),
  ]);

  const parts = toRows(partsSnap);
  const purchaseRequests = toRows(purchaseRequestSnap);
  const purchaseOrders = toRows(purchaseOrderSnap);
  const workOrders = toRows(workOrderSnap);
  const supplierParts = toRows(supplierPartSnap);
  const models = toRows(modelSnap);
  const workCenters = toRows(workCenterSnap);

  const analysis = analyzeMaterialPlanning({
    parts,
    purchaseRequests,
    purchaseOrders,
    workOrders,
    supplierParts,
    models,
  });

  const createdPurchaseRequests = [];
  const createdWorkOrders = [];

  for (const row of analysis) {
    if (row.severity !== 'critical' || row.netNeed <= 0) continue;

    if (row.supplyChannel === 'purchase') {
      const payload = {
        prNumber: createAutoPRNumber(),
        partId: row.part.id,
        partNumber: row.part.partNumber,
        partName: row.part.name,
        requestedQty: row.netNeed,
        status: 'Onaylandı',
        urgency: row.currentStock <= 0 ? 'Kritik' : 'Acil',
        neededByDate: addDays(todayIsoDate(), Math.max(1, Math.floor(numberValue(row.part.leadTimeDays) / 2) || 3)),
        suggestedSupplierId: row.preferredSupplier?.supplierId || '',
        suggestedSupplierName: row.preferredSupplier?.supplierName || '',
        estimatedUnitPrice: numberValue(row.preferredSupplier?.unitPrice),
        currency: row.preferredSupplier?.currency || 'TRY',
        requestedBy: actorName,
        requesterEmail: actorEmail,
        autoCreated: true,
        sourceModule: 'warehouse_material_control',
        notes: `Sistem otomatik satınalma talebi açtı. Depo stoğu kritik seviyeye düştü. Mevcut stok: ${row.currentStock}, minimum stok: ${row.threshold}, açık tedarik kapsamı: ${row.openCoverageQty}.`,
      };

      const result = await addPurchaseRequest(payload);
      createdPurchaseRequests.push({
        id: result.id,
        prNumber: payload.prNumber,
        partNumber: row.part.partNumber,
        qty: row.netNeed,
      });
      try {
        await queueAlert({
          partNumber: row.part.partNumber,
          partName: row.part.name,
          netNeed: row.netNeed,
          actorName,
          actorEmail,
          target: 'purchase_request',
        });
      } catch (alertError) {
        console.error('critical alert queue failed:', alertError);
      }
      continue;
    }

    const woNumber = await generateWorkOrderNumber();
    const firstModelUsage = row.part.usedInModels?.[0];
    const linkedModel = row.model || models.find((item) => item.id === firstModelUsage?.modelId) || null;
    const operations = buildDefaultOperations(workCenters);

    const payload = {
      woNumber,
      modelId: linkedModel?.id || '',
      modelCode: linkedModel?.modelCode || '',
      modelName: linkedModel?.modelName || '',
      productId: row.part.id,
      productPartId: row.part.id,
      productPartNumber: row.part.partNumber,
      productName: row.part.name,
      requestPartId: row.part.id,
      requestType: 'İç Üretim Talebi',
      quantity: row.netNeed,
      unit: row.part.unit || 'Adet',
      status: 'Taslak',
      priority: row.currentStock <= 0 ? 'Acil' : 'Yüksek',
      plannedStart: todayIsoDate(),
      plannedEnd: addDays(todayIsoDate(), Math.max(numberValue(row.part.leadTimeDays), 5)),
      responsibleEngineer: actorName,
      autoCreated: true,
      sourceModule: 'warehouse_material_control',
      notes: `Sistem otomatik iç üretim talebi açtı. Depo stoğu kritik seviyede. Mevcut stok: ${row.currentStock}, minimum stok: ${row.threshold}, açık üretim kapsamı: ${row.openCoverageQty}.`,
      components: (row.part.components || []).map((item) => ({
        partId: item.partId,
        partNumber: item.partNumber,
        name: item.name,
        qty: numberValue(item.qty),
        unit: item.unit || 'Adet',
      })),
      operations,
    };

    const result = await addWorkOrder(payload);
    createdWorkOrders.push({
      id: result.id,
      woNumber,
      partNumber: row.part.partNumber,
      qty: row.netNeed,
    });
    try {
      await queueAlert({
        partNumber: row.part.partNumber,
        partName: row.part.name,
        netNeed: row.netNeed,
        actorName,
        actorEmail,
        target: 'internal_production',
      });
    } catch (alertError) {
      console.error('critical alert queue failed:', alertError);
    }
  }

  return {
    analysis,
    createdPurchaseRequests,
    createdWorkOrders,
  };
}
