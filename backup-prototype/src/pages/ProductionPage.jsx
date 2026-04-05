import { useMemo, useState } from "react";

import { useAuth } from "../app/providers/AuthProvider";
import { DataTable } from "../components/DataTable";
import { FormField } from "../components/FormField";
import { InlineAlert } from "../components/InlineAlert";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { COLLECTIONS } from "../constants/collections";
import { OPERATION_STATUSES } from "../constants/statuses";
import { useCollection } from "../hooks/useCollection";
import {
  createProductionLog,
  createProductionOrder,
} from "../services/productionService";
import { formatDate } from "../utils/format";

const toOptions = (rows, getLabel) => rows.map((row) => ({ value: row.id, label: getLabel(row) }));

export function ProductionPage() {
  const { user } = useAuth();
  const models = useCollection(COLLECTIONS.MODELS);
  const warehouses = useCollection(COLLECTIONS.WAREHOUSES);
  const locations = useCollection(COLLECTIONS.LOCATIONS);
  const orders = useCollection(COLLECTIONS.PRODUCTION_ORDERS);
  const logs = useCollection(COLLECTIONS.PRODUCTION_LOGS);
  const [orderForm, setOrderForm] = useState({
    model_id: "",
    quantity: "",
    planned_date: "",
    status: "pending",
  });
  const [logForm, setLogForm] = useState({
    production_order_id: "",
    log_type: "start",
    operator_id: "",
    started_at: "",
    completed_at: "",
    lot_number: "",
    warehouse_id: "",
    location_id: "",
    good_quantity: "",
    scrap_quantity: "",
    allocations_text: "[]",
  });
  const [orderError, setOrderError] = useState("");
  const [logError, setLogError] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingLog, setSavingLog] = useState(false);

  const modelNames = useMemo(
    () =>
      Object.fromEntries(
        models.records.map((model) => [model.id, model.model_name || model.name || model.id]),
      ),
    [models.records],
  );

  const submitOrder = async (event) => {
    event.preventDefault();
    setSavingOrder(true);
    setOrderError("");
    try {
      await createProductionOrder(
        { ...orderForm, quantity: Number(orderForm.quantity || 0) },
        user?.uid,
      );
      setOrderForm({
        model_id: "",
        quantity: "",
        planned_date: "",
        status: "pending",
      });
    } catch (error) {
      setOrderError(error.message);
    } finally {
      setSavingOrder(false);
    }
  };

  const submitLog = async (event) => {
    event.preventDefault();
    setSavingLog(true);
    setLogError("");
    try {
      const materialAllocations =
        logForm.log_type === "start" ? JSON.parse(logForm.allocations_text || "[]") : [];
      await createProductionLog(
        {
          production_order_id: logForm.production_order_id,
          log_type: logForm.log_type,
          operator_id: logForm.operator_id,
          started_at: logForm.started_at,
          completed_at: logForm.completed_at,
          lot_number: logForm.lot_number,
          warehouse_id: logForm.warehouse_id,
          location_id: logForm.location_id,
          good_quantity: Number(logForm.good_quantity || 0),
          scrap_quantity: Number(logForm.scrap_quantity || 0),
          material_allocations: materialAllocations,
        },
        user?.uid,
      );
      setLogForm({
        production_order_id: "",
        log_type: "start",
        operator_id: "",
        started_at: "",
        completed_at: "",
        lot_number: "",
        warehouse_id: "",
        location_id: "",
        good_quantity: "",
        scrap_quantity: "",
        allocations_text: "[]",
      });
    } catch (error) {
      setLogError(error.message);
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Uretim Modulu"
        description="Is emri, BOM snapshot, malzeme tuketimi ve bitmis urun girisi akislari."
      />

      <SectionCard
        title="Uretim Emirleri"
        description="Model secildiginde servis BOM snapshot olusturur."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitOrder}>
            <InlineAlert kind="error" message={orderError} />
            <div className="form-grid">
              <FormField
                label="Model"
                name="model_id"
                type="select"
                required
                value={orderForm.model_id}
                onChange={(name, value) => setOrderForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(models.records, (model) => modelNames[model.id])}
              />
              <FormField
                label="Miktar"
                name="quantity"
                type="number"
                required
                min={1}
                step={1}
                value={orderForm.quantity}
                onChange={(name, value) => setOrderForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Plan Tarihi"
                name="planned_date"
                type="date"
                required
                value={orderForm.planned_date}
                onChange={(name, value) => setOrderForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Durum"
                name="status"
                type="select"
                value={orderForm.status}
                onChange={(name, value) => setOrderForm((current) => ({ ...current, [name]: value }))}
                options={OPERATION_STATUSES}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingOrder}>
                {savingOrder ? "Kaydediliyor..." : "Is Emri Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={orders.records}
            emptyMessage="Henuz is emri yok."
            columns={[
              { key: "model_id", label: "Model", render: (record) => modelNames[record.model_id] || record.model_id },
              { key: "quantity", label: "Miktar" },
              { key: "planned_date", label: "Plan", render: (record) => formatDate(record.planned_date) },
              { key: "status", label: "Durum", render: (record) => <StatusBadge value={record.status} /> },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Uretim Loglari"
        description="Baslatma kaydinda `material_allocations` JSON alani ile lot bazli tuketim tanimlayin."
        footer='JSON ornegi: [{"part_id":"part-1","lot_number":"LOT-1","warehouse_id":"wh-1","location_id":"loc-1","quantity":2}]'
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitLog}>
            <InlineAlert kind="error" message={logError} />
            <div className="form-grid">
              <FormField
                label="Uretim Emri"
                name="production_order_id"
                type="select"
                required
                value={logForm.production_order_id}
                onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(
                  orders.records,
                  (order) => `${modelNames[order.model_id] || order.model_id} / ${order.quantity}`,
                )}
              />
              <FormField
                label="Kayit Tipi"
                name="log_type"
                type="select"
                value={logForm.log_type}
                onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                options={[
                  { value: "start", label: "Baslatma" },
                  { value: "complete", label: "Tamamlama" },
                ]}
              />
              <FormField
                label="Operator"
                name="operator_id"
                value={logForm.operator_id}
                onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
              />
              {logForm.log_type === "start" ? (
                <FormField
                  label="Baslangic"
                  name="started_at"
                  type="date"
                  required
                  value={logForm.started_at}
                  onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                />
              ) : (
                <FormField
                  label="Bitis"
                  name="completed_at"
                  type="date"
                  required
                  value={logForm.completed_at}
                  onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                />
              )}
              {logForm.log_type === "complete" ? (
                <>
                  <FormField
                    label="Bitmis Urun Loti"
                    name="lot_number"
                    required
                    value={logForm.lot_number}
                    onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                  />
                  <FormField
                    label="Depo"
                    name="warehouse_id"
                    type="select"
                    required
                    value={logForm.warehouse_id}
                    onChange={(name, value) =>
                      setLogForm((current) => ({ ...current, [name]: value, location_id: "" }))
                    }
                    options={toOptions(warehouses.records, (warehouse) => warehouse.name)}
                  />
                  <FormField
                    label="Lokasyon"
                    name="location_id"
                    type="select"
                    required
                    value={logForm.location_id}
                    onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                    options={toOptions(
                      locations.records.filter(
                        (location) =>
                          !logForm.warehouse_id || location.warehouse_id === logForm.warehouse_id,
                      ),
                      (location) => location.code || location.name || location.id,
                    )}
                  />
                  <FormField
                    label="Saglam Miktar"
                    name="good_quantity"
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={logForm.good_quantity}
                    onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                  />
                  <FormField
                    label="Scrap Miktar"
                    name="scrap_quantity"
                    type="number"
                    min={0}
                    step={1}
                    value={logForm.scrap_quantity}
                    onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                  />
                </>
              ) : (
                <FormField
                  label="Malzeme Tahsisleri JSON"
                  name="allocations_text"
                  type="textarea"
                  value={logForm.allocations_text}
                  onChange={(name, value) => setLogForm((current) => ({ ...current, [name]: value }))}
                />
              )}
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={savingLog}>
                {savingLog ? "Kaydediliyor..." : "Log Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={logs.records}
            emptyMessage="Henuz uretim logu yok."
            columns={[
              { key: "production_order_id", label: "Is Emri" },
              { key: "log_type", label: "Tip", render: (record) => <StatusBadge value={record.log_type} /> },
              { key: "operator_id", label: "Operator" },
              {
                key: "created_at",
                label: "Tarih",
                render: (record) => formatDate(record.created_at || record.completed_at || record.started_at),
              },
            ]}
          />
        </div>
      </SectionCard>
    </div>
  );
}
