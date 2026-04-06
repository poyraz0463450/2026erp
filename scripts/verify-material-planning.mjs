import assert from 'node:assert/strict';
import { analyzeMaterialPlanning, resolveSupplyChannel } from '../src/services/materialPlanningCore.js';

const parts = [
  {
    id: 'raw_001',
    partNumber: 'HAM-4140-020',
    name: '4140 Çelik',
    category: 'Hammadde',
    type: 'Raw Material',
    currentStock: 4,
    minStock: 10,
    reorderPoint: 10,
    reorderQty: 20,
  },
  {
    id: 'assy_001',
    partNumber: 'ASM-ALT-GOVDE-001',
    name: 'Alt Gövde Montajı',
    category: 'Montaj',
    type: 'Assembly',
    isAssembly: true,
    currentStock: 1,
    minStock: 5,
    reorderPoint: 5,
    reorderQty: 8,
    components: [{ partId: 'cmp_001', partNumber: 'PAR-001', name: 'İç Parça', qty: 1, unit: 'Adet' }],
  },
  {
    id: 'cmp_001',
    partNumber: 'PAR-KILIT-001',
    name: 'Kilit Bloğu',
    category: 'Parça',
    type: 'Component',
    subCategory: 'Dövme Parça',
    currentStock: 18,
    minStock: 8,
    reorderPoint: 8,
  },
];

const purchaseRequests = [
  {
    id: 'pr_open_001',
    partId: 'raw_001',
    requestedQty: 8,
    status: 'Onaylandı',
  },
];

const purchaseOrders = [
  {
    id: 'po_open_001',
    status: 'Gönderildi',
    items: [{ partId: 'raw_001', qty: 10, deliveredQty: 0, remainingQty: 10 }],
  },
];

const workOrders = [
  {
    id: 'wo_open_001',
    productPartId: 'assy_001',
    quantity: 6,
    status: 'Taslak',
  },
];

const analysis = analyzeMaterialPlanning({
  parts,
  purchaseRequests,
  purchaseOrders,
  workOrders,
  supplierParts: [],
  models: [],
});

const rawRow = analysis.find((row) => row.part.id === 'raw_001');
const assyRow = analysis.find((row) => row.part.id === 'assy_001');
const componentRow = analysis.find((row) => row.part.id === 'cmp_001');

assert.equal(resolveSupplyChannel(parts[0]), 'purchase', 'Hammadde satınalma kanalına düşmeli');
assert.equal(resolveSupplyChannel(parts[1]), 'production', 'Montaj iç üretim kanalına düşmeli');
assert.equal(resolveSupplyChannel(parts[2]), 'production', 'İşlenen parça iç üretime düşmeli');

assert.equal(rawRow.severity, 'critical', 'Hammadde kritik görünmeli');
assert.equal(rawRow.openCoverageQty, 18, 'Açık PR + PO kapsaması toplanmalı');
assert.equal(rawRow.netNeed, 2, 'Net ihtiyaç açık kapsama düşülerek hesaplanmalı');

assert.equal(assyRow.severity, 'critical', 'Montaj kritik görünmeli');
assert.equal(assyRow.openCoverageQty, 6, 'Açık iş emri kapsamı hesaplanmalı');
assert.equal(assyRow.netNeed, 2, 'İç üretim ihtiyacı açık WO düşülerek hesaplanmalı');

assert.equal(componentRow.severity, 'normal', 'Yeterli stoklu parça normal görünmeli');

console.log('material-planning verification passed');
