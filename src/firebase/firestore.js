import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { LOCAL_DEMO_COLLECTIONS } from './demoFallbacks';

// ── Shared Utilities ──────────────────────────────────────────────────────────
const LOCAL_BACKED_COLLECTIONS = new Set(Object.keys(LOCAL_DEMO_COLLECTIONS));
const LOCAL_STORAGE_PREFIX = 'artegon.demo.';
const memoryLocalStore = new Map();
const visibleDocs = (snapshot) => snapshot.docs.filter((docSnap) => !String(docSnap.id || '').startsWith('probe_'));
const cloneValue = (value) => JSON.parse(JSON.stringify(value));
const stripId = (row) => {
  if (!row) return row;
  const { id, ...data } = row;
  return data;
};
const sortRows = (rows = []) =>
  [...rows].sort((left, right) => {
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
const buildLocalSnapshot = (rows = []) => ({
  docs: sortRows(rows).map((row) => ({
    id: row.id,
    data: () => stripId(cloneValue(row)),
  })),
});
const buildLocalDocSnapshot = (row, fallbackId = '') => ({
  id: row?.id || fallbackId,
  exists: () => Boolean(row),
  data: () => (row ? stripId(cloneValue(row)) : undefined),
});
const getLocalStorageKey = (colName) => `${LOCAL_STORAGE_PREFIX}${colName}`;
const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);
const getLocalSeed = (colName) => cloneValue(LOCAL_DEMO_COLLECTIONS[colName] || []);
const readLocalRows = (colName) => {
  if (!LOCAL_BACKED_COLLECTIONS.has(colName)) return [];

  if (canUseLocalStorage()) {
    const key = getLocalStorageKey(colName);
    const cached = window.localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        window.localStorage.removeItem(key);
      }
    }
    const seeded = getLocalSeed(colName);
    window.localStorage.setItem(key, JSON.stringify(seeded));
    return seeded;
  }

  if (!memoryLocalStore.has(colName)) {
    memoryLocalStore.set(colName, getLocalSeed(colName));
  }
  return cloneValue(memoryLocalStore.get(colName) || []);
};
const writeLocalRows = (colName, rows) => {
  if (!LOCAL_BACKED_COLLECTIONS.has(colName)) return;

  if (canUseLocalStorage()) {
    window.localStorage.setItem(getLocalStorageKey(colName), JSON.stringify(rows));
    return;
  }

  memoryLocalStore.set(colName, cloneValue(rows));
};
const createLocalId = (colName) =>
  `${colName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const getCollection = async (colName) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    return buildLocalSnapshot(readLocalRows(colName));
  }
  const snapshot = await getDocs(query(collection(db, colName), orderBy('createdAt', 'desc')));
  return { ...snapshot, docs: visibleDocs(snapshot) };
};
export const listenCollection = (colName, callback) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    callback(sortRows(readLocalRows(colName)).map((row) => ({ id: row.id, ...stripId(row) })));
    return () => {};
  }
  return onSnapshot(query(collection(db, colName), orderBy('createdAt', 'desc')), (snapshot) =>
    callback(visibleDocs(snapshot).map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
  );
};
export const getById = async (colName, id) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    return buildLocalDocSnapshot(readLocalRows(colName).find((row) => row.id === id), id);
  }
  return getDoc(doc(db, colName, id));
};
export const addData = async (colName, data) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    const rows = readLocalRows(colName);
    const now = new Date().toISOString();
    const id = data?.id || createLocalId(colName);
    rows.push({ ...cloneValue(data), id, createdAt: data?.createdAt || now, updatedAt: data?.updatedAt || now });
    writeLocalRows(colName, rows);
    return { id };
  }
  return addDoc(collection(db, colName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};
export const updateData = async (colName, id, data) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    const rows = readLocalRows(colName);
    const now = new Date().toISOString();
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...cloneValue(data), id, updatedAt: data?.updatedAt || now };
    } else {
      rows.push({ ...cloneValue(data), id, createdAt: data?.createdAt || now, updatedAt: data?.updatedAt || now });
    }
    writeLocalRows(colName, rows);
    return;
  }
  return updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() });
};
export const deleteData = async (colName, id) => {
  if (LOCAL_BACKED_COLLECTIONS.has(colName)) {
    writeLocalRows(colName, readLocalRows(colName).filter((row) => row.id !== id));
    return;
  }
  return deleteDoc(doc(db, colName, id));
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUserDoc = (uid) => getDoc(doc(db, 'users', uid));
export const setUserDoc = (uid, data) => setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() });
export const getAllUsers = () => getDocs(collection(db, 'users'));
export const updateUser = (uid, data) => updateData('users', uid, data);
export const deleteUser = (uid) => deleteData('users', uid);

// ── MODULE 1: PLM (Parts & Inventory) ──────────────────────────────────────────
export const getParts = () => getCollection('parts');
export const getPartById = (id) => getById('parts', id);
export const addPart = (data) => addData('parts', data);
export const updatePart = (id, data) => updateData('parts', id, data);
export const deletePart = (id) => deleteData('parts', id);

export const getModels = () => getCollection('models');
export const getModelById = (id) => getById('models', id);
export const addModel = (data) => addData('models', data);
export const updateModel = (id, data) => updateData('models', id, data);
export const deleteModel = (id) => deleteData('models', id);

export const getInventoryBatches = () => getCollection('inventory_lots');
export const getInventoryBatchById = (id) => getById('inventory_lots', id);
export const addInventoryBatch = (data) => addData('inventory_lots', data);
export const updateInventoryBatch = (id, data) => updateData('inventory_lots', id, data);
export const deleteInventoryBatch = (id) => deleteData('inventory_lots', id);

export const getStockMovements = () => getCollection('stock_movements');
export const addStockMovement = (data) => addData('stock_movements', data);
export const getBatchesByPart = async (partId) => {
  try {
    if (LOCAL_BACKED_COLLECTIONS.has('inventory_lots')) {
      return buildLocalSnapshot(readLocalRows('inventory_lots').filter((row) => row.partId === partId));
    }
    return await getDocs(query(collection(db, 'inventory_lots'), where('partId', '==', partId)));
  } catch {
    return { docs: [] };
  }
};

// ── MODULE 2: MES (Production) ────────────────────────────────────────────────
export const getWorkCenters = () => getCollection('work_centers').catch(() => ({ docs: [] }));
export const getWorkCenterById = (id) => getById('work_centers', id);
export const addWorkCenter = (data) => addData('work_centers', data);
export const updateWorkCenter = (id, data) => updateData('work_centers', id, data);
export const deleteWorkCenter = (id) => deleteData('work_centers', id);

export const getWorkOrders = () => getCollection('production_orders');
export const getWorkOrderById = (id) => getById('production_orders', id);
export const addWorkOrder = (data) => addData('production_orders', data);
export const updateWorkOrder = (id, data) => updateData('production_orders', id, data);
export const deleteWorkOrder = (id) => deleteData('production_orders', id);

// ── MODULE 3: QMS (Quality) ───────────────────────────────────────────────────
export const getInspectionPlans = () => getCollection('quality_plans');
export const getInspectionPlanById = (id) => getById('quality_plans', id);
export const addInspectionPlan = (data) => addData('quality_plans', data);
export const updateInspectionPlan = (id, data) => updateData('quality_plans', id, data);
export const deleteInspectionPlan = (id) => deleteData('quality_plans', id);

export const getQcInspections = () => getCollection('quality_records');
export const getQcInspectionById = (id) => getById('quality_records', id);
export const addQcInspection = (data) => addData('quality_records', data);
export const updateQcInspection = (id, data) => updateData('quality_records', id, data);
export const deleteQcInspection = (id) => deleteData('quality_records', id);

export const getNcrRecords = () => getCollection('nonconformities');
export const getNcrRecordById = (id) => getById('nonconformities', id);
export const addNcrRecord = (data) => addData('nonconformities', data);
export const updateNcrRecord = (id, data) => updateData('nonconformities', id, data);
export const deleteNcrRecord = (id) => deleteData('nonconformities', id);

// ── MODULE 4: PDM (Documents) ─────────────────────────────────────────────────
export const getDocuments = () => getCollection('documents').catch(() => ({ docs: [] }));
export const getDocumentById = (id) => getById('documents', id);
export const addDocument = (data) => addData('documents', data);
export const updateDocument = (id, data) => updateData('documents', id, data);
export const deleteDocument = (id) => deleteData('documents', id);

// ── MODULE 5: PURCHASING (SCM) ───────────────────────────────────────────────
export const getSuppliers = () => getCollection('suppliers');
export const getSupplierById = (id) => getById('suppliers', id);
export const addSupplier = (data) => addData('suppliers', data);
export const updateSupplier = (id, data) => updateData('suppliers', id, data);
export const deleteSupplier = (id) => deleteData('suppliers', id);

export const getPurchaseRequests = () => getCollection('purchase_requests');
export const getPurchaseRequestById = (id) => getById('purchase_requests', id);
export const addPurchaseRequest = (data) => addData('purchase_requests', data);
export const updatePurchaseRequest = (id, data) => updateData('purchase_requests', id, data);
export const deletePurchaseRequest = (id) => deleteData('purchase_requests', id);

export const getPurchaseOrders = () => getCollection('purchase_orders');
export const addPurchaseOrder = (data) => addData('purchase_orders', data);
export const updatePurchaseOrder = (id, data) => updateData('purchase_orders', id, data);
export const deletePurchaseOrder = (id) => deleteData('purchase_orders', id);

export const getRFQList = () => getCollection('rfq');
export const getASNList = async () => ({ docs: [] });

export const getRFQs = () => getCollection('rfq');
export const getRFQById = (id) => getById('rfq', id);
export const addRFQ = (data) => addData('rfq', data);
export const updateRFQ = (id, data) => updateData('rfq', id, data);

export const getASNs = () => getCollection('asn');
export const addASN = (data) => addData('asn', data);
export const updateASN = (id, data) => updateData('asn', id, data);

export const getSupplierParts = () => getCollection('supplier_parts').catch(() => ({ docs: [] }));
export const addSupplierPart = (data) => addData('supplier_parts', data);
export const updateSupplierPart = (id, data) => updateData('supplier_parts', id, data);
export const deleteSupplierPart = (id) => deleteData('supplier_parts', id);
export const getInvoices = () => getCollection('sales_invoices');
export const addInvoice = (data) =>
  addData('sales_invoices', {
    invoiceKind: data?.invoiceKind || (data?.supplierName || data?.poId ? 'purchase' : 'sales'),
    ...data,
  });
export const updateInvoice = (id, data) => updateData('sales_invoices', id, data);
export const getFinancialSettings = () => getById('settings', 'financials');
export const updateFinancialSettings = (data) => updateData('settings', 'financials', data);
export const getGoodsReceipts = () => getCollection('goods_receipts');
export const addGoodsReceipt = (data) => addData('goods_receipts', data);
export const updateGoodsReceipt = (id, data) => updateData('goods_receipts', id, data);
export const getPriceHistory = () => getCollection('price_history').catch(() => ({ docs: [] }));
export const addPriceHistory = (data) => addData('price_history', data);

export const getMachines = () => getCollection('machines').catch(() => ({ docs: [] }));
export const addMachine = (data) => addData('machines', data);
export const updateMachine = (id, data) => updateData('machines', id, data);
export const deleteMachine = (id) => deleteData('machines', id);

export const getWorkLogs = async (woId) => {
  try {
    if (LOCAL_BACKED_COLLECTIONS.has('production_logs')) {
      return buildLocalSnapshot(readLocalRows('production_logs').filter((row) => row.workOrderId === woId));
    }
    return await getDocs(
      query(collection(db, 'production_logs'), where('workOrderId', '==', woId), orderBy('createdAt', 'desc'))
    );
  } catch {
    return { docs: [] };
  }
};
export const addWorkLog = (data) => addData('production_logs', data);
export const updateWorkLog = (id, data) => updateData('production_logs', id, data);

export const getCycleCounts = () => getCollection('cycle_counts').catch(() => ({ docs: [] }));
export const addCycleCount = (data) => addData('cycle_counts', data);
export const updateCycleCount = (id, data) => updateData('cycle_counts', id, data);

export const getUsers = () => getAllUsers();
export const deleteUserDoc = (id) => deleteUser(id);

// ── MODULE 7: SALES (CRM & Orders) ───────────────────────────────────────────
export const getCustomers = () => getCollection('customers');
export const getCustomerById = (id) => getById('customers', id);
export const addCustomer = (data) => addData('customers', data);
export const updateCustomer = (id, data) => updateData('customers', id, data);
export const deleteCustomer = (id) => deleteData('customers', id);

export const getSalesOrders = () => getCollection('sales_orders');
export const getSalesOrderById = (id) => getById('sales_orders', id);
export const addSalesOrder = (data) => addData('sales_orders', data);
export const updateSalesOrder = (id, data) => updateData('sales_orders', id, data);
export const deleteSalesOrder = (id) => deleteData('sales_orders', id);

export const getShipments = () => getCollection('shipments');
export const addShipment = (data) => addData('shipments', data);
export const updateShipment = (id, data) => updateData('shipments', id, data);
