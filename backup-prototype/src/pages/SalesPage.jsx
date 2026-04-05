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
import { SALES_ORDER_STATUSES } from "../constants/statuses";
import { useCollection } from "../hooks/useCollection";
import {
  createCustomer,
  createSalesOrder,
  createShipment,
} from "../services/salesService";
import { formatDate } from "../utils/format";

const toOptions = (rows, getLabel) => rows.map((row) => ({ value: row.id, label: getLabel(row) }));

export function SalesPage() {
  const { user } = useAuth();
  const customers = useCollection(COLLECTIONS.CUSTOMERS);
  const models = useCollection(COLLECTIONS.MODELS);
  const orders = useCollection(COLLECTIONS.SALES_ORDERS);
  const shipments = useCollection(COLLECTIONS.SHIPMENTS);
  const warehouses = useCollection(COLLECTIONS.WAREHOUSES);
  const locations = useCollection(COLLECTIONS.LOCATIONS);
  const [salesOrderForm, setSalesOrderForm] = useState({
    customer_id: "",
    model_id: "",
    quantity: "",
    due_date: "",
    status: "created",
  });
  const [shipmentForm, setShipmentForm] = useState({
    sales_order_id: "",
    quantity: "",
    ship_date: "",
    lot_number: "",
    warehouse_id: "",
    location_id: "",
  });
  const [orderError, setOrderError] = useState("");
  const [shipmentError, setShipmentError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);

  const customerNames = Object.fromEntries(
    customers.records.map((customer) => [customer.id, customer.company_name || customer.name]),
  );
  const modelNames = useMemo(
    () =>
      Object.fromEntries(
        models.records.map((model) => [model.id, model.model_name || model.name || model.id]),
      ),
    [models.records],
  );

  const submitSalesOrder = async (event) => {
    event.preventDefault();
    setSavingOrder(true);
    setOrderError("");
    try {
      await createSalesOrder(
        { ...salesOrderForm, quantity: Number(salesOrderForm.quantity || 0) },
        user?.uid,
      );
      setSalesOrderForm({
        customer_id: "",
        model_id: "",
        quantity: "",
        due_date: "",
        status: "created",
      });
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  const submitShipment = async (event) => {
    event.preventDefault();
    setSavingShipment(true);
    setShipmentError("");
    try {
      await createShipment(
        { ...shipmentForm, quantity: Number(shipmentForm.quantity || 0) },
        user?.uid,
      );
      setShipmentForm({
        sales_order_id: "",
        quantity: "",
        ship_date: "",
        lot_number: "",
        warehouse_id: "",
        location_id: "",
      });
    } catch (error) {
      setShipmentError(error.message);
    } finally {
      setSavingShipment(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Satis Modulu"
        description="Musteri, satis siparisi ve sevkiyat akislarini yonetin. Sevkiyat stoktan otomatik dusulur."
      />

      <RecordManager
        title="Musteriler"
        description="Musteri kartlari."
        fields={[
          { name: "company_name", label: "Firma Adi", required: true },
          { name: "contact_person", label: "Yetkili" },
          { name: "contact_email", label: "E-posta", type: "email" },
          { name: "contact_phone", label: "Telefon", type: "tel" },
        ]}
        initialValues={{
          company_name: "",
          contact_person: "",
          contact_email: "",
          contact_phone: "",
        }}
        onSubmit={(values) => createCustomer(values, user?.uid)}
        submitLabel="Musteri Kaydet"
        records={customers.records}
        emptyMessage="Henuz musteri yok."
        columns={[
          { key: "company_name", label: "Firma" },
          { key: "contact_person", label: "Yetkili" },
          { key: "contact_email", label: "E-posta" },
          { key: "contact_phone", label: "Telefon" },
        ]}
      />

      <SectionCard
        title="Satis Siparisleri"
        description="Model bazli siparis olusturun. Siparisler uretim tetikleyebilir."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitSalesOrder}>
            <InlineAlert kind="error" message={orderError} />
            <div className="form-grid">
              <FormField
                label="Musteri"
                name="customer_id"
                type="select"
                required
                value={salesOrderForm.customer_id}
                onChange={(name, value) => setSalesOrderForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(customers.records, (customer) => customer.company_name || customer.name)}
              />
              <FormField
                label="Model"
                name="model_id"
                type="select"
                required
                value={salesOrderForm.model_id}
                onChange={(name, value) => setSalesOrderForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(models.records, (model) => modelNames[model.id])}
              />
              <FormField
                label="Miktar"
                name="quantity"
                type="number"
                required
                min={1}
                step={1}
                value={salesOrderForm.quantity}
                onChange={(name, value) => setSalesOrderForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Termin"
                name="due_date"
                type="date"
                required
                value={salesOrderForm.due_date}
                onChange={(name, value) => setSalesOrderForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Durum"
                name="status"
                type="select"
                value={salesOrderForm.status}
                onChange={(name, value) => setSalesOrderForm((current) => ({ ...current, [name]: value }))}
                options={SALES_ORDER_STATUSES}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingOrder}>
                {savingOrder ? "Kaydediliyor..." : "Siparis Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={orders.records}
            emptyMessage="Henuz satis siparisi yok."
            columns={[
              { key: "customer_id", label: "Musteri", render: (record) => customerNames[record.customer_id] || record.customer_id },
              { key: "model_id", label: "Model", render: (record) => modelNames[record.model_id] || record.model_id },
              { key: "quantity", label: "Miktar" },
              { key: "due_date", label: "Termin", render: (record) => formatDate(record.due_date) },
              { key: "status", label: "Durum", render: (record) => <StatusBadge value={record.status} /> },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Sevkiyatlar"
        description="Hazir urunleri sevk edin. Stok yoksa sevkiyat olusmaz."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitShipment}>
            <InlineAlert kind="error" message={shipmentError} />
            <div className="form-grid">
              <FormField
                label="Satis Siparisi"
                name="sales_order_id"
                type="select"
                required
                value={shipmentForm.sales_order_id}
                onChange={(name, value) => setShipmentForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(
                  orders.records,
                  (order) =>
                    `${customerNames[order.customer_id] || order.customer_id} / ${
                      modelNames[order.model_id] || order.model_id
                    }`,
                )}
              />
              <FormField
                label="Miktar"
                name="quantity"
                type="number"
                required
                min={1}
                step={1}
                value={shipmentForm.quantity}
                onChange={(name, value) => setShipmentForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Sevk Tarihi"
                name="ship_date"
                type="date"
                required
                value={shipmentForm.ship_date}
                onChange={(name, value) => setShipmentForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Lot Numarasi"
                name="lot_number"
                required
                value={shipmentForm.lot_number}
                onChange={(name, value) => setShipmentForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Depo"
                name="warehouse_id"
                type="select"
                required
                value={shipmentForm.warehouse_id}
                onChange={(name, value) =>
                  setShipmentForm((current) => ({ ...current, [name]: value, location_id: "" }))
                }
                options={toOptions(warehouses.records, (warehouse) => warehouse.name)}
              />
              <FormField
                label="Lokasyon"
                name="location_id"
                type="select"
                required
                value={shipmentForm.location_id}
                onChange={(name, value) => setShipmentForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(
                  locations.records.filter(
                    (location) =>
                      !shipmentForm.warehouse_id || location.warehouse_id === shipmentForm.warehouse_id,
                  ),
                  (location) => location.code || location.name || location.id,
                )}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingShipment}>
                {savingShipment ? "Kaydediliyor..." : "Sevkiyat Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={shipments.records}
            emptyMessage="Henuz sevkiyat yok."
            columns={[
              { key: "sales_order_id", label: "Siparis" },
              { key: "model_id", label: "Model", render: (record) => modelNames[record.model_id] || record.model_id },
              { key: "quantity", label: "Miktar" },
              { key: "ship_date", label: "Tarih", render: (record) => formatDate(record.ship_date) },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  );
}
