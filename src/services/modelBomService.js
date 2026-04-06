const numberValue = (value) => Number(value || 0);
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const usageMatchesModel = (usage = {}, modelRef = {}) => {
  const usageId = usage.modelId || usage.model_id || usage.id || '';
  const usageCode = usage.modelCode || usage.model_code || usage.code || '';
  const usageName = usage.modelName || usage.model_name || usage.name || '';

  if (modelRef.modelId && usageId && normalizeText(usageId) === normalizeText(modelRef.modelId)) return true;
  if (modelRef.modelCode && usageCode && normalizeText(usageCode) === normalizeText(modelRef.modelCode)) return true;
  if (modelRef.modelName && usageName && normalizeText(usageName) === normalizeText(modelRef.modelName)) return true;
  return false;
};

const toModelRef = ({ model = null, modelId = '', modelCode = '', modelName = '' } = {}) => ({
  modelId: modelId || model?.id || '',
  modelCode: modelCode || model?.modelCode || '',
  modelName: modelName || model?.modelName || '',
});

export const getAvailableStock = (part) =>
  Math.max(numberValue(part?.currentStock) - numberValue(part?.reservedStock), 0);

export const isProductLikePart = (part) =>
  part?.type === 'Product' ||
  part?.category === 'Mamul' ||
  String(part?.partNumber || '').startsWith('PRD-');

export const findModelById = (models = [], modelId = '') =>
  models.find((model) => model.id === modelId) || null;

export const findProductPartForModel = (parts = [], modelId = '', modelCode = '', modelName = '') => {
  const modelRef = toModelRef({ modelId, modelCode, modelName });
  return (
  parts.find(
    (part) =>
      isProductLikePart(part) &&
      part.usedInModels?.some((usage) => usageMatchesModel(usage, modelRef))
  ) || null
  );
};

export const getModelBomRows = (parts = [], modelId = '', explicitProductPart = null, model = null) => {
  const modelRef = toModelRef({ model, modelId });
  const productPart = explicitProductPart || findProductPartForModel(parts, modelRef.modelId, modelRef.modelCode, modelRef.modelName);

  if (productPart?.components?.length) {
    return productPart.components
      .map((component) => {
        const sourcePart = parts.find((part) => part.id === component.partId);
        return {
          partId: component.partId,
          partNumber: component.partNumber || sourcePart?.partNumber || '',
          name: component.name || sourcePart?.name || '',
          qty: numberValue(component.qty),
          unit: component.unit || sourcePart?.unit || 'Adet',
          sourcePart,
        };
      })
      .filter((row) => row.partId && row.qty > 0);
  }

  const rowsFromPartLinks = parts
    .filter((part) => part.usedInModels?.some((usage) => usageMatchesModel(usage, modelRef)))
    .filter((part) => part.id !== productPart?.id)
    .map((part) => {
      const usage = part.usedInModels?.find((item) => usageMatchesModel(item, modelRef));
      return {
        partId: part.id,
        partNumber: part.partNumber,
        name: part.name,
        qty: numberValue(usage?.qtyPerUnit),
        unit: part.unit || 'Adet',
        sourcePart: part,
      };
    })
    .filter((row) => row.qty > 0);

  if (rowsFromPartLinks.length) return rowsFromPartLinks;

  const modelBom = model?.bomItems || model?.bom || model?.parts || [];
  if (!Array.isArray(modelBom) || !modelBom.length) return [];

  return modelBom
    .map((item) => {
      const partId = item.partId || item.part_id || item.id || '';
      const sourcePart = parts.find((part) => part.id === partId);
      return {
        partId,
        partNumber: item.partNumber || sourcePart?.partNumber || '',
        name: item.name || sourcePart?.name || '',
        qty: numberValue(item.qty || item.quantity || item.qtyPerUnit || item.requiredQty),
        unit: item.unit || sourcePart?.unit || 'Adet',
        sourcePart,
      };
    })
    .filter((row) => row.partId && row.qty > 0 && row.partId !== productPart?.id);
};

export const buildVirtualProductPart = (model, parts = []) => {
  if (!model) return null;
  const topLevelRows = getModelBomRows(parts, model.id, null, model);

  return {
    id: `virtual_product_${model.id}`,
    isVirtual: true,
    type: 'Product',
    category: 'Mamul',
    subCategory: 'Mamul',
    unit: 'Adet',
    revision: 'A',
    revisionStatus: 'Taslak',
    currentStock: 0,
    reservedStock: 0,
    minStock: 0,
    isAssembly: true,
    partNumber: `PRD-${model.modelCode || model.id}`,
    name: model.modelName || model.modelCode || 'Tanımsız Model',
    modelId: model.id,
    usedInModels: [
      {
        modelId: model.id,
        modelCode: model.modelCode || '',
        modelName: model.modelName || '',
        qtyPerUnit: 1,
      },
    ],
    components: topLevelRows.map((row) => ({
      partId: row.partId,
      partNumber: row.partNumber,
      name: row.name,
      qty: row.qty,
      unit: row.unit,
    })),
  };
};

export const resolveProductPartForModel = ({ parts = [], model = null, modelId = '' } = {}) => {
  const modelRef = toModelRef({ model, modelId });
  const realProductPart = findProductPartForModel(parts, modelRef.modelId, modelRef.modelCode, modelRef.modelName);
  if (realProductPart) return realProductPart;
  if (!model) return null;
  return buildVirtualProductPart(model, parts);
};

const accumulateDemand = (bucket, part, requiredQty) => {
  if (!part?.id || requiredQty <= 0) return;
  const current = bucket.get(part.id) || {
    partId: part.id,
    partNumber: part.partNumber || '',
    name: part.name || '',
    unit: part.unit || 'Adet',
    requiredQty: 0,
    availableQty: getAvailableStock(part),
    sourcePart: part,
  };

  current.requiredQty += requiredQty;
  current.availableQty = getAvailableStock(part);
  current.sourcePart = part;
  bucket.set(part.id, current);
};

const explodePartDemand = (partId, qtyMultiplier, partMap, bucket, visited = new Set()) => {
  const part = partMap.get(partId);
  if (!part || qtyMultiplier <= 0) return;

  const visitKey = `${partId}:${qtyMultiplier}`;
  if (visited.has(visitKey)) {
    accumulateDemand(bucket, part, qtyMultiplier);
    return;
  }

  if (part.components?.length) {
    const nextVisited = new Set(visited);
    nextVisited.add(visitKey);

    part.components.forEach((component) => {
      explodePartDemand(
        component.partId,
        qtyMultiplier * numberValue(component.qty),
        partMap,
        bucket,
        nextVisited
      );
    });
    return;
  }

  accumulateDemand(bucket, part, qtyMultiplier);
};

export const explodeModelDemand = ({
  parts = [],
  model = null,
  modelId = '',
  quantity = 0,
  productPart = null,
} = {}) => {
  const effectiveModel = model || null;
  const effectiveProductPart =
    productPart ||
    resolveProductPartForModel({ parts, model: effectiveModel, modelId });
  const rootRows = getModelBomRows(parts, modelId || effectiveModel?.id, effectiveProductPart, effectiveModel);
  const partMap = new Map(parts.map((part) => [part.id, part]));
  const bucket = new Map();

  rootRows.forEach((row) => {
    if (!row.partId) return;
    explodePartDemand(row.partId, numberValue(row.qty) * numberValue(quantity), partMap, bucket);
  });

  return [...bucket.values()].map((row) => ({
    ...row,
    shortageQty: Math.max(row.requiredQty - row.availableQty, 0),
  }));
};
