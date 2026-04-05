import { useMemo, useState } from "react";

import { useAuth } from "../app/providers/AuthProvider";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { RecordManager } from "../components/RecordManager";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { COLLECTIONS } from "../constants/collections";
import {
  PURCHASE_ORDER_STATUSES,
  PURCHASE_REQUEST_STATUSES,
} from "../constants/statuses";
import { useCollection } from "../hooks/useCollection";
import {
  createGoodsReceipt,
  createPurchaseOrder,
  createPurchaseRequest,
  createSupplier,
} from "../services/purchasingService";
import { formatCurrency, formatDate } from "../utils/format";

const blankItem = () => ({ part_id: "", quantity: 1, unit_price: 0 });
const toOptions = (rows, getLabel) => rows.map((row) => ({ value: row.id, label: getLabel(row) }));

export function PurchasingPage() {
  const { user } = useAuth();
  const suppliers = useCollection(COLLECTIONS.SUPPLIERS);
  const parts = useCollection(COLLECTIONS.PARTS);
  const requests = useCollection(COLLECTIONS.PURCHASE_REQUESTS);
  const orders = useCollection(COLLECTIONS.PURCHASE_ORDERS);
  const receipts = useCollection(COLLECTIONS.GOODS_RECEIPTS);
  const warehouses = useCollection(COLLECTIONS.WAREHOUSES);
  const locations = useCollection(COLLECTIONS.LOCATIONS);

  const [orderForm, setOrderForm] = useState({
    supplier_id: "",
    purchase_request_id: "",
    order_date: "",
    status: "created",
    items: [blankItem()],
  });
  const [receiptForm, setReceiptForm] = useState({
    purchase_order_id: "",
    part_id: "",
    received_quantity: "",
    lot_number: "",
    warehouse_id: "",
    location_id: "",
    receipt_date: "",
  });
  const [orderError, setOrderError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);

  const partNames = useMemo(
    () =>
      Object.fromEntries(
        parts.records.map((part) => [
          part.id,
          `${part.part_number || ""} ${part.part_name || ""}`.trim() || part.id,
        ]),
      ),
    [parts.records],
  );
  const supplierNames = useMemo(
    () => Object.fromEntries(suppliers.records.map((supplier) => [supplier.id, supplier.name])),
    [suppliers.records],
  );

  const supplierFields = [
    { name: "name", label: "Tedarikci Adi", required: true },
    { name: "contact_email", label: "E-posta", type: "email" },
    { name: "contact_phone", label: "Telefon", type: "tel" },
    { name: "contact_person", label: "Yetkili Kisi" },
  ];
  const requestFields = [
    {
      name: "part_id",
      label: "Parca",
      type: "select",
      required: true,
      options: toOptions(parts.records, (part) => partNames[part.id]),
    },
    { name: "quantity", label: "Miktar", type: "number", required: true, min: 1, step: 1 },
    { name: "request_date", label: "Talep Tarihi", type: "date", required: true },
    { name: "status", label: "Durum", type: "select", options: PURCHASE_REQUEST_STATUSES },
    { name: "description", label: "Aciklama", type: "textarea" },
  ];

  const receiptOrder = orders.records.find((order) => order.id === receiptForm.purchase_order_id);
  const receiptPartOptions = receiptOrder
    ? receiptOrder.items.map((item) => ({
        value: item.part_id,
        label: `${partNames[item.part_id] || item.part_id} / kalan ${
          item.quantity - (item.received_quantity || 0)
        }`,
      }))
    : [];
  const approvedRequestOptions = toOptions(
    requests.records.filter((request) => request.status === "approved"),
    (request) => `${partNames[request.part_id] || request.part_id} / ${request.quantity}`,
  );
  const locationOptions = toOptions(
    locations.records.filter(
      (location) =>
        !receiptForm.warehouse_id || location.warehouse_id === receiptForm.warehouse_id,
    ),
    (location) => location.code || location.name || location.id,
  );

  const onOrderChange = (name, value) => {
    setOrderForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "purchase_request_id") {
        const request = requests.records.find((row) => row.id === value);
        if (request) {
          next.items = [{ part_id: request.part_id, quantity: request.quantity, unit_price: 0 }];
        }
      }
      return next;
    });
  };

  const onOrderItemChange = (index, name, value) =>
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [name]: value } : item,
      ),
    }));

  const submitOrder = async (event) => {
    event.preventDefault();
    setSavingOrder(true);
    setOrderError("");
    try {
      await createPurchaseOrder(orderForm, user?.uid);
      setOrderForm({
        supplier_id: "",
        purchase_request_id: "",
        order_date: "",
        status: "created",
        items: [blankItem()],
      });
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  const submitReceipt = async (event) => {
    event.preventDefault();
    setSavingReceipt(true);
    setReceiptError("");
    try {
      await createGoodsReceipt(receiptForm, user?.uid);
      setReceiptForm({
        purchase_order_id: "",
        part_id: "",
        received_quantity: "",
        lot_number: "",
        warehouse_id: "",
        location_id: "",
        receipt_date: "",
      });
    } catch (error) {
      setReceiptError(error.message);
    } finally {
      setSavingReceipt(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Satin Alma Modulu"
        description="Tedarikci, satin alma talebi, siparis ve mal kabul akisini yonetin. Mal kabul sonrasi stok otomatik karantinaya alinir."
      />

      <RecordManager
        title="Tedarikci Yonetimi"
        description="Tedarikci kartlari."
        fields={supplierFields}
        initialValues={{ name: "", contact_email: "", contact_phone: "", contact_person: "" }}
        onSubmit={(values) => createSupplier(values, user?.uid)}
        submitLabel="Tedarikci Kaydet"
        records={suppliers.records}
        emptyMessage="Henuz tedarikci yok."
        columns={[
          { key: "name", label: "Tedarikci" },
          { key: "contact_person", label: "Yetkili" },
          { key: "contact_email", label: "E-posta" },
          { key: "contact_phone", label: "Telefon" },
        ]}
      />

      <RecordManager
        title="Satin Alma Talepleri"
        description="Parca bazli talep kaydi."
        fields={requestFields}
        initialValues={{
          part_id: "",
          quantity: 1,
          request_date: "",
          status: "pending",
          description: "",
        }}
        onSubmit={(values) => createPurchaseRequest(values, user?.uid)}
        submitLabel="Talep Olustur"
        records={requests.records}
        emptyMessage="Henuz talep yok."
        note="Onayli talepler siparise donusturulebilir."
        columns={[
          {
            key: "part_id",
            label: "Parca",
            render: (record) => partNames[record.part_id] || record.part_id,
          },
          { key: "quantity", label: "Miktar" },
          { key: "request_date", label: "Tarih", render: (record) => formatDate(record.request_date) },
          { key: "status", label: "Durum", render: (record) => <StatusBadge value={record.status} /> },
        ]}
      />

      <SectionCard
        title="Satin Alma Siparisleri"
        description="Onayli talepten veya dogrudan siparis olusturun."
        footer="Toplam tutar servis tarafinda otomatik hesaplanir."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitOrder}>
            <InlineAlert kind="error" message={orderError} />
            <div className="form-grid">
              <FormField
                label="Tedarikci"
                name="supplier_id"
                type="select"
                required
                value={orderForm.supplier_id}
                onChange={onOrderChange}
                options={toOptions(suppliers.records, (supplier) => supplier.name)}
              />
              <FormField
                label="Ilgili Talep"
                name="purchase_request_id"
                type="select"
                value={orderForm.purchase_request_id}
                onChange={onOrderChange}
                options={approvedRequestOptions}
              />
              <FormField
                label="Siparis Tarihi"
                name="order_date"
                type="date"
                required
                value={orderForm.order_date}
                onChange={onOrderChange}
              />
              <FormField
                label="Durum"
                name="status"
                type="select"
                value={orderForm.status}
                onChange={onOrderChange}
                options={PURCHASE_ORDER_STATUSES}
              />
            </div>

            <div className="nested-form-card">
              <div className="nested-form-card__header">
                <h3>Kalemler</h3>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() =>
                    setOrderForm((current) => ({ ...current, items: [...current.items, blankItem()] }))
                  }
                >
                  Kalem Ekle
                </button>
              </div>
              <div className="stack">
                {orderForm.items.map((item, index) => (
                  <div className="order-item-row" key={`order-item-${index}`}>
                    <FormField
                      label="Parca"
                      name="part_id"
                      type="select"
                      required
                      value={item.part_id}
                      onChange={(name, value) => onOrderItemChange(index, name, value)}
                      options={toOptions(parts.records, (part) => partNames[part.id])}
                    />
                    <FormField
                      label="Miktar"
                      name="quantity"
                      type="number"
                      required
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(name, value) => onOrderItemChange(index, name, value)}
                    />
                    <FormField
                      label="Birim Fiyat"
                      name="unit_price"
                      type="number"
                      required
                      min={0}
                      step={0.01}
                      value={item.unit_price}
                      onChange={(name, value) => onOrderItemChange(index, name, value)}
                    />
                    <button
                      className="button button--ghost button--danger"
                      type="button"
                      disabled={orderForm.items.length === 1}
                      onClick={() =>
                        setOrderForm((current) => ({
                          ...current,
                          items: current.items.filter((_, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingOrder}>
                {savingOrder ? "Kaydediliyor..." : "Siparis Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={orders.records}
            emptyMessage="Henuz siparis yok."
            columns={[
              {
                key: "supplier_id",
                label: "Tedarikci",
                render: (record) => supplierNames[record.supplier_id] || record.supplier_id,
              },
              { key: "order_date", label: "Tarih", render: (record) => formatDate(record.order_date) },
              {
                key: "items",
                label: "Kalemler",
                render: (record) =>
                  record.items
                    ?.map((item) => `${partNames[item.part_id] || item.part_id} x ${item.quantity}`)
                    .join(", ") || "-",
              },
              {
                key: "total_amount",
                label: "Toplam",
                render: (record) => formatCurrency(record.total_amount),
              },
              { key: "status", label: "Durum", render: (record) => <StatusBadge value={record.status} /> },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Mal Kabul Kayitlari"
        description="Siparis disinda stok girisi yapilamaz. Lot ve lokasyon secimi zorunludur."
        footer="Kural: Gelen miktar siparis kalemindeki kalan miktari asamaz."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitReceipt}>
            <InlineAlert kind="error" message={receiptError} />
            <div className="form-grid">
              <FormField
                label="Satin Alma Siparisi"
                name="purchase_order_id"
                type="select"
                required
                value={receiptForm.purchase_order_id}
                onChange={(name, value) =>
                  setReceiptForm((current) => ({
                    ...current,
                    [name]: value,
                    part_id: "",
                  }))
                }
                options={toOptions(
                  orders.records.filter((order) => order.status !== "cancelled"),
                  (order) => `${supplierNames[order.supplier_id] || order.supplier_id} / ${order.order_date || order.id}`,
                )}
              />
              <FormField
                label="Parca"
                name="part_id"
                type="select"
                required
                value={receiptForm.part_id}
                onChange={(name, value) => setReceiptForm((current) => ({ ...current, [name]: value }))}
                options={receiptPartOptions}
              />
              <FormField
                label="Gelen Miktar"
                name="received_quantity"
                type="number"
                required
                min={1}
                step={1}
                value={receiptForm.received_quantity}
                onChange={(name, value) => setReceiptForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Lot Numarasi"
                name="lot_number"
                required
                value={receiptForm.lot_number}
                onChange={(name, value) => setReceiptForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Depo"
                name="warehouse_id"
                type="select"
                required
                value={receiptForm.warehouse_id}
                onChange={(name, value) =>
                  setReceiptForm((current) => ({ ...current, [name]: value, location_id: "" }))
                }
                options={toOptions(
                  warehouses.records,
                  (warehouse) => `${warehouse.code || warehouse.name || warehouse.id}`,
                )}
              />
              <FormField
                label="Lokasyon"
                name="location_id"
                type="select"
                required
                value={receiptForm.location_id}
                onChange={(name, value) => setReceiptForm((current) => ({ ...current, [name]: value }))}
                options={locationOptions}
              />
              <FormField
                label="Mal Kabul Tarihi"
                name="receipt_date"
                type="date"
                required
                value={receiptForm.receipt_date}
                onChange={(name, value) => setReceiptForm((current) => ({ ...current, [name]: value }))}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingReceipt}>
                {savingReceipt ? "Kaydediliyor..." : "Mal Kabul Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={receipts.records}
            emptyMessage="Henuz mal kabul yok."
            columns={[
              { key: "purchase_order_id", label: "PO" },
              {
                key: "part_id",
                label: "Parca",
                render: (record) => partNames[record.part_id] || record.part_id,
              },
              { key: "received_quantity", label: "Miktar" },
              { key: "lot_number", label: "Lot" },
              { key: "receipt_date", label: "Tarih", render: (record) => formatDate(record.receipt_date) },
              { key: "qc_status", label: "QC", render: (record) => <StatusBadge value={record.qc_status} /> },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  );
}
