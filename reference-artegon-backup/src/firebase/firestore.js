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

// ── Shared Utilities ──────────────────────────────────────────────────────────
export const getCollection = (colName) => getDocs(query(collection(db, colName), orderBy('createdAt', 'desc')));
export const listenCollection = (colName, callback) => onSnapshot(query(collection(db, colName), orderBy('createdAt', 'desc')), (s) => callback(s.docs.map(d => ({ id: d.id, ...d.data() }))));
export const getById = (colName, id) => getDoc(doc(db, colName, id));
export const addData = (colName, data) => addDoc(collection(db, colName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const updateData = (colName, id, data) => updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() });
export const deleteData = (colName, id) => deleteDoc(doc(db, colName, id));

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

export const getInventoryBatches = () => getCollection('inventory_batches');
export const getInventoryBatchById = (id) => getById('inventory_batches', id);
export const addInventoryBatch = (data) => addData('inventory_batches', data);
export const updateInventoryBatch = (id, data) => updateData('inventory_batches', id, data);
export const deleteInventoryBatch = (id) => deleteData('inventory_batches', id);

export const getStockMovements = () => getCollection('stock_movements');
export const addStockMovement = (data) => addData('stock_movements', data);
export const getBatchesByPart = (partId) => getDocs(query(collection(db, 'inventory_batches'), where('partId', '==', partId)));

// ── MODULE 2: MES (Production) ────────────────────────────────────────────────
export const getWorkCenters = () => getCollection('work_centers');
export const getWorkCenterById = (id) => getById('work_centers', id);
export const addWorkCenter = (data) => addData('work_centers', data);
export const updateWorkCenter = (id, data) => updateData('work_centers', id, data);
export const deleteWorkCenter = (id) => deleteData('work_centers', id);

export const getWorkOrders = () => getCollection('work_orders');
export const getWorkOrderById = (id) => getById('work_orders', id);
export const addWorkOrder = (data) => addData('work_orders', data);
export const updateWorkOrder = (id, data) => updateData('work_orders', id, data);
export const deleteWorkOrder = (id) => deleteData('work_orders', id);

// ── MODULE 3: QMS (Quality) ───────────────────────────────────────────────────
export const getInspectionPlans = () => getCollection('inspection_plans');
export const getInspectionPlanById = (id) => getById('inspection_plans', id);
export const addInspectionPlan = (data) => addData('inspection_plans', data);
export const updateInspectionPlan = (id, data) => updateData('inspection_plans', id, data);
export const deleteInspectionPlan = (id) => deleteData('inspection_plans', id);

export const getQcInspections = () => getCollection('qc_inspections');
export const getQcInspectionById = (id) => getById('qc_inspections', id);
export const addQcInspection = (data) => addData('qc_inspections', data);
export const updateQcInspection = (id, data) => updateData('qc_inspections', id, data);
export const deleteQcInspection = (id) => deleteData('qc_inspections', id);

export const getNcrRecords = () => getCollection('ncr_records');
export const getNcrRecordById = (id) => getById('ncr_records', id);
export const addNcrRecord = (data) => addData('ncr_records', data);
export const updateNcrRecord = (id, data) => updateData('ncr_records', id, data);
export const deleteNcrRecord = (id) => deleteData('ncr_records', id);

// ── MODULE 4: PDM (Documents) ─────────────────────────────────────────────────
export const getDocuments = () => getCollection('documents');
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

export const getRFQList = async () => ({ docs: [] });
export const getASNList = async () => ({ docs: [] });

export const getRFQs = () => getCollection('rfq');
export const getRFQById = (id) => getById('rfq', id);
export const addRFQ = (data) => addData('rfq', data);
export const updateRFQ = (id, data) => updateData('rfq', id, data);

export const getASNs = () => getCollection('asn');
export const addASN = (data) => addData('asn', data);
export const updateASN = (id, data) => updateData('asn', id, data);

export const getSupplierParts = () => getCollection('supplier_parts');
export const addSupplierPart = (data) => addData('supplier_parts', data);
export const updateSupplierPart = (id, data) => updateData('supplier_parts', id, data);
export const deleteSupplierPart = (id) => deleteData('supplier_parts', id);
export const getInvoices = () => getCollection('sales_invoices');
export const addInvoice = (data) => addData('sales_invoices', data);
export const updateInvoice = (id, data) => updateData('sales_invoices', id, data);
export const getFinancialSettings = () => getById('settings', 'financials');
export const updateFinancialSettings = (data) => setDoc(doc(db, 'settings', 'financials'), { ...data, updatedAt: serverTimestamp() });
export const getGoodsReceipts = () => getCollection('goods_receipts');
export const addGoodsReceipt = (data) => addData('goods_receipts', data);
export const updateGoodsReceipt = (id, data) => updateData('goods_receipts', id, data);
export const getPriceHistory = () => getDocs(query(collection(db, 'price_history'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] }));
export const addPriceHistory = (data) => addDoc(collection(db, 'price_history'), { ...data, createdAt: serverTimestamp() });

export const getMachines = () => getCollection('machines');
export const addMachine = (data) => addData('machines', data);
export const updateMachine = (id, data) => updateData('machines', id, data);
export const deleteMachine = (id) => deleteData('machines', id);

export const getWorkLogs = (woId) => getDocs(query(collection(db, 'work_logs'), where('workOrderId', '==', woId), orderBy('createdAt', 'desc')));
export const addWorkLog = (data) => addData('work_logs', data);
export const updateWorkLog = (id, data) => updateData('work_logs', id, data);

export const getCycleCounts = () => getCollection('cycle_counts');
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
