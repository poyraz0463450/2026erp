import { analyzeMaterialPlanning } from '../src/services/materialPlanningCore.js';
import {
  explodeModelDemand,
  getAvailableStock,
  resolveProductPartForModel,
} from '../src/services/modelBomService.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const model = {
  id: 'model_art001',
  modelCode: 'ART-001',
  modelName: 'ART-001 Demo Model',
};

const parts = [
  {
    id: 'part_leaf_a',
    partNumber: 'ART001-0001',
    name: 'Kilitleme Bloğu',
    category: 'Parça',
    subCategory: '4140 Çelik',
    unit: 'Adet',
    currentStock: 1100,
    reservedStock: 200,
    minStock: 950,
    components: [],
    usedInModels: [],
  },
  {
    id: 'part_leaf_b',
    partNumber: 'ART001-0002',
    name: 'Yay',
    category: 'Hammadde',
    subCategory: 'Yay',
    unit: 'Adet',
    currentStock: 2200,
    reservedStock: 200,
    minStock: 300,
    components: [],
    usedInModels: [{ modelId: model.id, modelCode: model.modelCode, modelName: model.modelName, qtyPerUnit: 3 }],
  },
  {
    id: 'part_assy',
    partNumber: 'ASM-ART001-001',
    name: 'Alt Grup',
    category: 'Montaj',
    subCategory: 'Montaj',
    unit: 'Adet',
    currentStock: 10,
    reservedStock: 0,
    minStock: 2,
    isAssembly: true,
    components: [
      { partId: 'part_leaf_a', partNumber: 'ART001-0001', name: 'Kilitleme Bloğu', qty: 2, unit: 'Adet' },
      { partId: 'part_leaf_b', partNumber: 'ART001-0002', name: 'Yay', qty: 1, unit: 'Adet' },
    ],
    usedInModels: [{ modelId: model.id, modelCode: model.modelCode, modelName: model.modelName, qtyPerUnit: 1 }],
  },
];

const virtualProduct = resolveProductPartForModel({ parts, model });
assert(virtualProduct?.isVirtual === true, 'Model için sanal mamul kartı oluşturulmalı');
assert(virtualProduct.partNumber === 'PRD-ART-001', 'Sanal mamul part number modeli baz almalı');

const explodedDemand = explodeModelDemand({
  parts,
  model,
  modelId: model.id,
  quantity: 500,
  productPart: virtualProduct,
});

const demandA = explodedDemand.find((row) => row.partId === 'part_leaf_a');
const demandB = explodedDemand.find((row) => row.partId === 'part_leaf_b');

assert(demandA?.requiredQty === 1000, 'ART001-0001 için 500 siparişte 1000 adet ihtiyaç hesaplanmalı');
assert(demandB?.requiredQty === 2000, 'ART001-0002 için 500 siparişte 2000 adet ihtiyaç hesaplanmalı');
assert(getAvailableStock(parts[0]) === 900, 'Rezerve stok kullanılabilir stoktan düşülmeli');

const planning = analyzeMaterialPlanning({
  parts,
  purchaseRequests: [],
  purchaseOrders: [],
  workOrders: [],
  supplierParts: [{ partId: 'part_leaf_b', supplierId: 'sup_1', supplierName: 'Yay Tedarik', isPreferred: true }],
  models: [model],
});

const plannedA = planning.find((row) => row.part.id === 'part_leaf_a');
const plannedB = planning.find((row) => row.part.id === 'part_leaf_b');

assert(plannedA?.currentStock === 900, 'Planlama net stok olarak current-reserved kullanmalı');
assert(plannedA?.severity === 'critical', 'Rezerve sonrası kritik stok uyarısı oluşmalı');
assert(plannedB?.supplyChannel === 'purchase', 'Yay alt kategorisi satın alma kanalına yönlenmeli');

console.log('order-flow verification passed');
