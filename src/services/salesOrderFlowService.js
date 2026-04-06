import {
  addData,
  addPart,
  addPurchaseRequest,
  addWorkOrder,
  addStockMovement,
  getPurchaseRequests,
  getWorkCenters,
  getWorkOrders,
  updatePart,
} from '../firebase/firestore';
import { generateWorkOrderNumber } from '../utils/autoGen';
import {
  explodeModelDemand,
  getAvailableStock,
  getModelBomRows,
  resolveProductPartForModel,
} from './modelBomService';
import { syncMaterialPlanning } from './materialPlanningService';
import { resolveSupplyChannel } from './materialPlanningCore';

const numberValue = (value) => Number(value || 0);
const todayIsoDate = () => new Date().toISOString().slice(0, 10);
const PR_OPEN_STATUSES = ['Taslak', 'Pending Approval', 'Onaylandı', 'Approved'];
const WO_OPEN_STATUSES = ['Taslak', 'Onaylı', 'Malzeme Hazır', 'Üretimde', 'Kalitede', 'In Production'];

const addDays = (dateText, days) => {
  const date = new Date(`${dateText}T08:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildDefaultOperations = (centers = []) => {
  const findCenter = (...keywords) =>
    centers.find((center) =>
      keywords.some((keyword) =>
        `${center.name || ''} ${center.type || ''} ${center.code || ''}`
          .toLowerCase()
          .includes(keyword)
      )
    )?.id || '';

  return [
    { step: 1, name: 'Malzeme Hazırlık', workCenterId: findCenter('hazırlık', 'i̇şleme', 'torna', 'vmc'), status: 'Beklemede', manualHours: 1.5 },
    { step: 2, name: 'İşleme / Üretim', workCenterId: findCenter('vmc', 'hmc', 'torna', 'pres', 'enjeksiyon'), status: 'Beklemede', manualHours: 4 },
    { step: 3, name: 'Ara Kalite Kontrol', workCenterId: findCenter('kalite', 'qc'), status: 'Beklemede', manualHours: 0.75 },
    { step: 4, name: 'Boya / Tesviye / Isıl İşlem', workCenterId: findCenter('kaplama', 'boya', 'tesviye', 'ısıl', 'heat'), status: 'Beklemede', manualHours: 2 },
    { step: 5, name: 'Nihai Kalite Onayı', workCenterId: findCenter('kalite', 'qc'), status: 'Beklemede', manualHours: 0.75 },
    { step: 6, name: 'Depo Teslim Hazırlığı', workCenterId: findCenter('montaj', 'assy'), status: 'Beklemede', manualHours: 0.5 },
  ];
};

export async function ensureProductPartForModel({ model, parts = [] }) {
  const resolved = resolveProductPartForModel({ parts, model });
  if (!resolved?.isVirtual) return resolved;

  const payload = {
    partNumber: resolved.partNumber,
    name: resolved.name,
    category: 'Mamul',
    subCategory: 'Mamul',
    unit: 'Adet',
    type: 'Product',
    revision: 'A',
    revisionStatus: 'Taslak',
    currentStock: 0,
    reservedStock: 0,
    minStock: 0,
    warehouseLocation: 'FG-01-01',
    stockStatus: 'Sağlam',
    isAssembly: true,
    isCritical: true,
    material: 'Çoklu',
    materialStandard: '',
    description: `${model.modelCode} modeli için otomatik oluşturulan mamul kartı`,
    usedInModels: resolved.usedInModels,
    components: resolved.components,
  };

  const result = await addPart(payload);
  return { id: result.id, ...payload };
}

export async function reserveSalesOrderDemand({
  salesOrderId,
  model,
  productPart,
  parts = [],
  quantity,
  actorName = 'Sistem',
} = {}) {
  const readyStockQty = Math.min(getAvailableStock(productPart), numberValue(quantity));
  const productionQty = Math.max(numberValue(quantity) - readyStockQty, 0);
  const reservations = [];
  const shortages = [];

  if (readyStockQty > 0 && productPart?.id) {
    await updatePart(productPart.id, {
      reservedStock: numberValue(productPart.reservedStock) + readyStockQty,
    });

    await addStockMovement({
      partId: productPart.id,
      partNumber: productPart.partNumber,
      movementType: 'Satış Siparişi Rezervasyonu',
      qty: readyStockQty,
      referenceNumber: salesOrderId,
      performedBy: actorName,
      note: `${model.modelCode} satış siparişi için hazır mamul rezerve edildi`,
      fromLocation: productPart.warehouseLocation || '',
    });

    reservations.push({
      partId: productPart.id,
      partNumber: productPart.partNumber,
      qty: readyStockQty,
      kind: 'finished_good',
    });
  }

  if (productionQty <= 0) {
    return {
      readyStockQty,
      productionQty,
      demandRows: [],
      reservations,
      shortages: [],
    };
  }

  const demandRows = explodeModelDemand({
    parts,
    model,
    modelId: model.id,
    quantity: productionQty,
    productPart,
  });

  for (const row of demandRows) {
    const reserveQty = Math.min(numberValue(row.availableQty), numberValue(row.requiredQty));
    const shortageQty = Math.max(numberValue(row.requiredQty) - reserveQty, 0);

    if (reserveQty > 0) {
      await updatePart(row.partId, {
        reservedStock: numberValue(row.sourcePart?.reservedStock) + reserveQty,
      });

      await addStockMovement({
        partId: row.partId,
        partNumber: row.partNumber,
        movementType: 'Satış Siparişi Rezervasyonu',
        qty: reserveQty,
        referenceNumber: salesOrderId,
        performedBy: actorName,
        note: `${model.modelCode} üretim ihtiyacı için rezerve edildi`,
        fromLocation: row.sourcePart?.warehouseLocation || '',
      });

      reservations.push({
        partId: row.partId,
        partNumber: row.partNumber,
        qty: reserveQty,
        kind: 'component',
      });
    }

    if (shortageQty > 0) {
      shortages.push({
        partId: row.partId,
        partNumber: row.partNumber,
        name: row.name,
        qty: shortageQty,
        unit: row.unit,
      });
    }
  }

  return {
    readyStockQty,
    productionQty,
    demandRows,
    reservations,
    shortages,
  };
}

export async function buildProductionRequestForSalesOrder({
  salesOrder,
  model,
  productPart,
  parts = [],
  quantity,
  actorName = 'Sistem',
} = {}) {
  const centerSnap = await getWorkCenters();
  const centers = centerSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const components = productPart?.components?.length
    ? productPart.components.map((item) => ({
        partId: item.partId,
        partNumber: item.partNumber,
        name: item.name,
        qty: numberValue(item.qty),
        unit: item.unit || 'Adet',
      }))
    : getModelBomRows(parts, model.id, productPart, model).map((item) => ({
        partId: item.partId,
        partNumber: item.partNumber,
        name: item.name,
        qty: numberValue(item.qty),
        unit: item.unit || 'Adet',
      }));

  return {
    woNumber: await generateWorkOrderNumber(),
    salesOrderId: salesOrder.id,
    modelId: model.id,
    modelCode: model.modelCode,
    modelName: model.modelName,
    productId: productPart?.id || '',
    productPartId: productPart?.id || '',
    productPartNumber: productPart?.partNumber || '',
    productName: productPart?.name || model.modelName,
    quantity: numberValue(quantity),
    unit: productPart?.unit || 'Adet',
    status: 'Taslak',
    priority: 'Acil',
    plannedStart: todayIsoDate(),
    plannedEnd: addDays(todayIsoDate(), 7),
    colorOption: salesOrder.colorOption || '',
    surfaceOption: salesOrder.surfaceOption || '',
    specialRequest: salesOrder.specialRequest || '',
    notes:
      salesOrder.specialRequest ||
      `${salesOrder.soNumber} satış siparişinden otomatik üretim talebi oluşturuldu.`,
    createdBy: actorName,
    requestType: 'Satış Siparişi Talebi',
    components,
    operations: buildDefaultOperations(centers),
  };
}

export async function triggerSalesOrderPlanning({
  salesOrder,
  model,
  productPart,
  parts = [],
  actorName = 'Sistem',
  actorEmail = 'system@artegon.local',
} = {}) {
  const reservation = await reserveSalesOrderDemand({
    salesOrderId: salesOrder.id,
    model,
    productPart,
    parts,
    quantity: salesOrder.quantity,
    actorName,
  });

  const createdActions = { purchaseRequests: [], workOrders: [] };
  if (reservation.shortages?.length) {
    const [prSnap, woSnap, centerSnap] = await Promise.all([getPurchaseRequests(), getWorkOrders(), getWorkCenters()]);
    const existingPRs = prSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const existingWOs = woSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const centers = centerSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    for (const shortage of reservation.shortages) {
      const part = parts.find((item) => item.id === shortage.partId);
      if (!part) continue;
      const channel = resolveSupplyChannel(part);

      if (channel === 'purchase') {
        const hasOpenPR = existingPRs.some((item) => item.partId === part.id && PR_OPEN_STATUSES.includes(item.status));
        if (!hasOpenPR) {
          const prPayload = {
            prNumber: `PR-${new Date().getFullYear()}-SO-${Date.now().toString().slice(-5)}`,
            partId: part.id,
            partNumber: part.partNumber,
            partName: part.name,
            requestedQty: Math.ceil(numberValue(shortage.qty)),
            status: 'Onaylandı',
            urgency: 'Kritik',
            neededByDate: addDays(todayIsoDate(), 2),
            requestedBy: actorName,
            requesterEmail: actorEmail,
            autoCreated: true,
            sourceModule: 'sales_order_planning',
            sourceSalesOrderId: salesOrder.id,
            notes: `${salesOrder.soNumber} siparişi için eksik parça tespit edildi.`,
          };
          const prDoc = await addPurchaseRequest(prPayload);
          createdActions.purchaseRequests.push({ id: prDoc.id, ...prPayload });
          existingPRs.push({ id: prDoc.id, ...prPayload });
        }
      } else {
        const hasOpenWO = existingWOs.some((item) => (item.requestPartId === part.id || item.productPartId === part.id || item.productId === part.id) && WO_OPEN_STATUSES.includes(item.status));
        if (!hasOpenWO) {
          const woPayload = {
            woNumber: await generateWorkOrderNumber(),
            modelId: model.id,
            modelCode: model.modelCode,
            modelName: model.modelName,
            productId: part.id,
            productPartId: part.id,
            productPartNumber: part.partNumber,
            productName: part.name,
            quantity: Math.ceil(numberValue(shortage.qty)),
            unit: shortage.unit || part.unit || 'Adet',
            status: 'Taslak',
            priority: 'Acil',
            plannedStart: todayIsoDate(),
            plannedEnd: addDays(todayIsoDate(), 4),
            requestPartId: part.id,
            requestType: 'Satış Siparişi Eksik Malzeme',
            notes: `${salesOrder.soNumber} siparişi için eksik iç üretim kalemi.`,
            createdBy: actorName,
            autoCreated: true,
            sourceSalesOrderId: salesOrder.id,
            components: (part.components || []).map((item) => ({ partId: item.partId, partNumber: item.partNumber, name: item.name, qty: numberValue(item.qty), unit: item.unit || 'Adet' })),
            operations: buildDefaultOperations(centers),
          };
          const woDoc = await addWorkOrder(woPayload);
          createdActions.workOrders.push({ id: woDoc.id, ...woPayload });
          existingWOs.push({ id: woDoc.id, ...woPayload });
        }
      }

      try {
        await addData('logs', {
          user_id: actorEmail,
          action: 'sales_order_shortage_detected',
          sourceSalesOrderId: salesOrder.id,
          partId: part.id,
          partNumber: part.partNumber,
          qty: numberValue(shortage.qty),
          channel,
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        await addData('mail_queue', {
          to: 'purchasing@artegon.local',
          cc: actorEmail,
          subject: `[SATIŞ SİPARİŞİ EKSİK] ${part.partNumber}`,
          body: `${salesOrder.soNumber} siparişi için ${part.partNumber} eksik. Kanal: ${channel}.`,
          status: 'queued',
          module: 'sales',
          createdAt: new Date().toISOString(),
        });
      } catch (alertError) {
        console.error('shortage alert queue failed:', alertError);
      }
    }
  }

  await syncMaterialPlanning({ actorName, actorEmail });
  return { ...reservation, createdActions };
}
