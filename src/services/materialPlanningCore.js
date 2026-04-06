import { getAvailableStock } from './modelBomService.js';

const PURCHASE_REQUEST_OPEN_STATUSES = ['Taslak', 'Pending Approval', 'Onaylandı'];
const PURCHASE_ORDER_OPEN_STATUSES = ['Taslak', 'Gönderildi', 'Kısmi Teslim'];
const WORK_ORDER_OPEN_STATUSES = ['Taslak', 'Onaylı', 'Malzeme Hazır', 'Üretimde', 'Kalitede'];

const PURCHASE_SUBCATEGORY_HINTS = ['yay', 'pim', 'vida', 'standart', 'polimer', 'pa6', 'pom'];

const numberValue = (value) => Number(value || 0);

const getThreshold = (part) => Math.max(numberValue(part.reorderPoint), numberValue(part.minStock));

export const resolveSupplyChannel = (part) => {
  if (part?.supplyMode === 'purchase' || part?.supplyMode === 'production') {
    return part.supplyMode;
  }

  if (part?.category === 'Hammadde' || part?.type === 'Raw Material') {
    return 'purchase';
  }

  if (
    part?.category === 'Montaj' ||
    part?.category === 'Mamul' ||
    part?.type === 'Assembly' ||
    part?.type === 'Product' ||
    part?.isAssembly
  ) {
    return 'production';
  }

  const hintText = `${part?.subCategory || ''} ${part?.material || ''}`.toLowerCase();
  if (PURCHASE_SUBCATEGORY_HINTS.some((token) => hintText.includes(token))) {
    return 'purchase';
  }

  return 'production';
};

const getSeverity = (part) => {
  const threshold = getThreshold(part);
  const availableStock = getAvailableStock(part);

  if (threshold <= 0) return 'normal';
  if (availableStock <= 0) return 'critical';
  if (availableStock <= threshold) return 'critical';
  if (availableStock <= threshold * 1.5) return 'warning';
  return 'normal';
};

const getTargetQty = (part) => {
  const threshold = getThreshold(part);
  const availableStock = getAvailableStock(part);
  const explicitQty = numberValue(part.reorderQty);

  if (explicitQty > 0) return explicitQty;
  return Math.max(threshold * 2 - availableStock, threshold - availableStock, 1);
};

const getReplenishmentNeed = (part) => {
  const threshold = getThreshold(part);
  const availableStock = getAvailableStock(part);

  if (threshold <= 0 || availableStock > threshold) return 0;
  return Math.max(getTargetQty(part), threshold - availableStock, 1);
};

const getPurchaseCoverage = (partId, purchaseRequests, purchaseOrders) => {
  const relatedRequests = purchaseRequests.filter(
    (request) => request.partId === partId && PURCHASE_REQUEST_OPEN_STATUSES.includes(request.status)
  );
  const relatedOrders = purchaseOrders.filter((order) => {
    if (!PURCHASE_ORDER_OPEN_STATUSES.includes(order.status)) return false;
    return (order.items || []).some((item) => item.partId === partId);
  });

  const requestQty = relatedRequests.reduce((sum, request) => sum + numberValue(request.requestedQty), 0);
  const orderQty = relatedOrders.reduce((sum, order) => {
    const itemQty = (order.items || [])
      .filter((item) => item.partId === partId)
      .reduce(
        (itemSum, item) =>
          itemSum +
          Math.max(numberValue(item.remainingQty), numberValue(item.qty) - numberValue(item.deliveredQty)),
        0
      );
    return sum + itemQty;
  }, 0);

  return {
    quantity: requestQty + orderQty,
    requests: relatedRequests,
    orders: relatedOrders,
  };
};

const getProductionCoverage = (partId, workOrders) => {
  const relatedOrders = workOrders.filter((order) => {
    if (!WORK_ORDER_OPEN_STATUSES.includes(order.status)) return false;
    return order.requestPartId === partId || order.productId === partId || order.productPartId === partId;
  });

  return {
    quantity: relatedOrders.reduce((sum, order) => sum + numberValue(order.quantity), 0),
    orders: relatedOrders,
  };
};

export const analyzeMaterialPlanning = ({
  parts = [],
  purchaseRequests = [],
  purchaseOrders = [],
  workOrders = [],
  supplierParts = [],
  models = [],
} = {}) =>
  parts
    .map((part) => {
      const threshold = getThreshold(part);
      const availableStock = getAvailableStock(part);
      const physicalStock = numberValue(part.currentStock);
      const reservedStock = numberValue(part.reservedStock);
      const severity = getSeverity(part);
      const supplyChannel = resolveSupplyChannel(part);
      const replenishmentNeed = getReplenishmentNeed(part);
      const coverage =
        supplyChannel === 'purchase'
          ? getPurchaseCoverage(part.id, purchaseRequests, purchaseOrders)
          : getProductionCoverage(part.id, workOrders);
      const netNeed = Math.max(replenishmentNeed - numberValue(coverage.quantity), 0);
      const preferredSources = supplierParts.filter((item) => item.partId === part.id);
      const preferredSupplier = preferredSources.find((item) => item.isPreferred) || preferredSources[0] || null;
      const firstUsage = (part.usedInModels || [])[0];
      const model = models.find((item) => item.id === firstUsage?.modelId) || null;

      return {
        part,
        threshold,
        currentStock: availableStock,
        availableStock,
        physicalStock,
        reservedStock,
        severity,
        replenishmentNeed,
        openCoverageQty: numberValue(coverage.quantity),
        netNeed,
        supplyChannel,
        preferredSupplier,
        relatedRequests: coverage.requests || [],
        relatedOrders: coverage.orders || [],
        model,
        actionStarted: replenishmentNeed > 0 && numberValue(coverage.quantity) > 0,
      };
    })
    .filter((row) => row.threshold > 0)
    .sort((left, right) => {
      const severityRank = { critical: 0, warning: 1, normal: 2 };
      if (severityRank[left.severity] !== severityRank[right.severity]) {
        return severityRank[left.severity] - severityRank[right.severity];
      }
      return right.netNeed - left.netNeed;
    });
