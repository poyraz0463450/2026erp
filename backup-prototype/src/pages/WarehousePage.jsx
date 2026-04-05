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
import { ITEM_TYPES, MOVEMENT_TYPES } from "../constants/statuses";
import { useCollection } from "../hooks/useCollection";
import {
  createLocation,
  createStockMovement,
  createWarehouse,
} from "../services/warehouseService";
import { formatDate, formatNumber } from "../utils/format";

const toOptions = (rows, getLabel) => rows.map((row) => ({ value: row.id, label: getLabel(row) }));

export function WarehousePage() {
  const { user } = useAuth();
  const parts = useCollection(COLLECTIONS.PARTS);
  const models = useCollection(COLLECTIONS.MODELS);
  const warehouses = useCollection(COLLECTIONS.WAREHOUSES);
  const locations = useCollection(COLLECTIONS.LOCATIONS);
  const lots = useCollection(COLLECTIONS.INVENTORY_LOTS);
  const movements = useCollection(COLLECTIONS.STOCK_MOVEMENTS);
  const [movementForm, setMovementForm] = useState({
    movement_type: "entry",
    item_type: "part",
    item_id: "",
    warehouse_id: "",
    location_id: "",
    from_location_id: "",
    to_location_id: "",
    lot_number: "",
    quantity: "",
    counted_quantity: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const itemOptions = movementForm.item_type === "part" ? parts.records : models.records;
  const itemLabels = useMemo(
    () => ({
      ...Object.fromEntries(
        parts.records.map((part) => [
          part.id,
          `${part.part_number || ""} ${part.part_name || ""}`.trim() || part.id,
        ]),
      ),
      ...Object.fromEntries(
        models.records.map((model) => [model.id, model.model_name || model.name || model.id]),
      ),
    }),
    [models.records, parts.records],
  );

  const submitMovement = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createStockMovement(
        {
          ...movementForm,
          quantity: Number(movementForm.quantity || 0),
          counted_quantity: Number(movementForm.counted_quantity || 0),
        },
        user?.uid,
      );
      setMovementForm({
        movement_type: "entry",
        item_type: "part",
        item_id: "",
        warehouse_id: "",
        location_id: "",
        from_location_id: "",
        to_location_id: "",
        lot_number: "",
        quantity: "",
        counted_quantity: "",
        note: "",
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Depo Yonetimi"
        description="Depo, lokasyon, lot bazli stok hareketleri ve sayim duzeltmelerini yonetin."
      />

      <RecordManager
        title="Depolar"
        description="Depo kartlari."
        fields={[
          { name: "code", label: "Kod", required: true },
          { name: "name", label: "Depo Adi", required: true },
          { name: "description", label: "Aciklama", type: "textarea" },
        ]}
        initialValues={{ code: "", name: "", description: "" }}
        onSubmit={(values) => createWarehouse(values, user?.uid)}
        submitLabel="Depo Kaydet"
        records={warehouses.records}
        emptyMessage="Henuz depo yok."
        columns={[
          { key: "code", label: "Kod" },
          { key: "name", label: "Depo" },
          { key: "description", label: "Aciklama" },
        ]}
      />

      <RecordManager
        title="Lokasyonlar"
        description="Raf / lokasyon kayitlari."
        fields={[
          {
            name: "warehouse_id",
            label: "Depo",
            type: "select",
            required: true,
            options: toOptions(warehouses.records, (warehouse) => warehouse.name),
          },
          { name: "code", label: "Lokasyon Kodu", required: true },
          { name: "name", label: "Lokasyon Adi" },
          { name: "description", label: "Aciklama", type: "textarea" },
        ]}
        initialValues={{ warehouse_id: "", code: "", name: "", description: "" }}
        onSubmit={(values) => createLocation(values, user?.uid)}
        submitLabel="Lokasyon Kaydet"
        records={locations.records}
        emptyMessage="Henuz lokasyon yok."
        columns={[
          {
            key: "warehouse_id",
            label: "Depo",
            render: (record) =>
              warehouses.records.find((warehouse) => warehouse.id === record.warehouse_id)?.name ||
              record.warehouse_id,
          },
          { key: "code", label: "Kod" },
          { key: "name", label: "Lokasyon" },
        ]}
      />

      <SectionCard
        title="Stok Hareketleri"
        description="Stok girisi, stok cikisi, transfer ve sayim islemlerini lot bazli yonetin."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitMovement}>
            <InlineAlert kind="error" message={error} />
            <div className="form-grid">
              <FormField
                label="Hareket Tipi"
                name="movement_type"
                type="select"
                value={movementForm.movement_type}
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                options={MOVEMENT_TYPES.filter((item) =>
                  ["entry", "exit", "transfer", "cycle_count"].includes(item.value),
                )}
              />
              <FormField
                label="Kalem Tipi"
                name="item_type"
                type="select"
                value={movementForm.item_type}
                onChange={(name, value) =>
                  setMovementForm((current) => ({ ...current, [name]: value, item_id: "" }))
                }
                options={ITEM_TYPES}
              />
              <FormField
                label="Urun"
                name="item_id"
                type="select"
                required
                value={movementForm.item_id}
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(itemOptions, (item) => itemLabels[item.id])}
              />
              <FormField
                label="Depo"
                name="warehouse_id"
                type="select"
                required
                value={movementForm.warehouse_id}
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(warehouses.records, (warehouse) => warehouse.name)}
              />
              <FormField
                label={movementForm.movement_type === "transfer" ? "Kaynak Lokasyon" : "Lokasyon"}
                name={movementForm.movement_type === "transfer" ? "from_location_id" : "location_id"}
                type="select"
                required
                value={
                  movementForm.movement_type === "transfer"
                    ? movementForm.from_location_id
                    : movementForm.location_id
                }
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(
                  locations.records.filter(
                    (location) =>
                      !movementForm.warehouse_id || location.warehouse_id === movementForm.warehouse_id,
                  ),
                  (location) => location.code || location.name || location.id,
                )}
              />
              {movementForm.movement_type === "transfer" ? (
                <FormField
                  label="Hedef Lokasyon"
                  name="to_location_id"
                  type="select"
                  required
                  value={movementForm.to_location_id}
                  onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                  options={toOptions(
                    locations.records.filter(
                      (location) =>
                        !movementForm.warehouse_id || location.warehouse_id === movementForm.warehouse_id,
                    ),
                    (location) => location.code || location.name || location.id,
                  )}
                />
              ) : null}
              <FormField
                label="Lot Numarasi"
                name="lot_number"
                required
                value={movementForm.lot_number}
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
              />
              {movementForm.movement_type === "cycle_count" ? (
                <FormField
                  label="Sayilan Miktar"
                  name="counted_quantity"
                  type="number"
                  required
                  value={movementForm.counted_quantity}
                  onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                />
              ) : (
                <FormField
                  label="Miktar"
                  name="quantity"
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={movementForm.quantity}
                  onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
                />
              )}
              <FormField
                label="Not"
                name="note"
                type="textarea"
                value={movementForm.note}
                onChange={(name, value) => setMovementForm((current) => ({ ...current, [name]: value }))}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Hareket Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={movements.records}
            emptyMessage="Henuz stok hareketi yok."
            columns={[
              { key: "movement_type", label: "Tip", render: (record) => <StatusBadge value={record.movement_type} /> },
              { key: "item_id", label: "Urun", render: (record) => itemLabels[record.item_id] || record.item_id },
              { key: "lot_number", label: "Lot" },
              { key: "quantity", label: "Miktar", render: (record) => formatNumber(record.quantity) },
              { key: "created_at", label: "Tarih", render: (record) => formatDate(record.created_at) },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Stok Ozeti" description="Gercek stok lot gorunumu.">
        <DataTable
          records={lots.records}
          emptyMessage="Henuz lot bazli stok yok."
          columns={[
            { key: "item_type", label: "Tip", render: (record) => <StatusBadge value={record.item_type} /> },
            { key: "item_id", label: "Urun", render: (record) => itemLabels[record.item_id] || record.item_id },
            { key: "lot_number", label: "Lot" },
            { key: "available_quantity", label: "Kullanilabilir", render: (record) => formatNumber(record.available_quantity) },
            { key: "quarantine_quantity", label: "Karantina", render: (record) => formatNumber(record.quarantine_quantity) },
            { key: "rejected_quantity", label: "Red", render: (record) => formatNumber(record.rejected_quantity) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
