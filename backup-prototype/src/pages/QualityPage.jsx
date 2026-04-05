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
  NONCONFORMITY_ACTIONS,
  QUALITY_RESULTS,
  QUALITY_TYPES,
} from "../constants/statuses";
import { useCollection } from "../hooks/useCollection";
import {
  createNonconformity,
  createQualityPlan,
  createQualityRecord,
} from "../services/qualityService";
import { formatDate } from "../utils/format";

const toOptions = (rows, getLabel) => rows.map((row) => ({ value: row.id, label: getLabel(row) }));

export function QualityPage() {
  const { user } = useAuth();
  const parts = useCollection(COLLECTIONS.PARTS);
  const goodsReceipts = useCollection(COLLECTIONS.GOODS_RECEIPTS);
  const plans = useCollection(COLLECTIONS.QUALITY_PLANS);
  const records = useCollection(COLLECTIONS.QUALITY_RECORDS);
  const nonconformities = useCollection(COLLECTIONS.NONCONFORMITIES);
  const [recordForm, setRecordForm] = useState({
    inspection_type: "incoming",
    part_id: "",
    goods_receipt_id: "",
    operation_name: "",
    result: "accepted",
    inspection_date: "",
    measurement_data: "",
    notes: "",
  });
  const [recordError, setRecordError] = useState("");
  const [saving, setSaving] = useState(false);

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

  const submitRecord = async (event) => {
    event.preventDefault();
    setSaving(true);
    setRecordError("");
    try {
      await createQualityRecord(recordForm, user?.uid);
      setRecordForm({
        inspection_type: "incoming",
        part_id: "",
        goods_receipt_id: "",
        operation_name: "",
        result: "accepted",
        inspection_date: "",
        measurement_data: "",
        notes: "",
      });
    } catch (error) {
      setRecordError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Kalite Kontrol"
        description="Kalite plani, giris kalite kontrol, proses ici kontrol, final kontrol ve uygunsuzluk kayitlarini yonetin."
      />

      <RecordManager
        title="Kalite Planlari"
        description="Parca bazli kontrol kriterleri."
        fields={[
          {
            name: "part_id",
            label: "Parca",
            type: "select",
            required: true,
            options: toOptions(parts.records, (part) => partNames[part.id]),
          },
          { name: "criteria", label: "Kontrol Kriteri", required: true },
          { name: "upper_tolerance", label: "Ust Tolerans", type: "number", step: 0.001 },
          { name: "lower_tolerance", label: "Alt Tolerans", type: "number", step: 0.001 },
          { name: "measurement_method", label: "Olcum Yontemi", required: true },
          { name: "notes", label: "Notlar", type: "textarea" },
        ]}
        initialValues={{
          part_id: "",
          criteria: "",
          upper_tolerance: "",
          lower_tolerance: "",
          measurement_method: "",
          notes: "",
        }}
        onSubmit={(values) => createQualityPlan(values, user?.uid)}
        submitLabel="Plan Kaydet"
        records={plans.records}
        emptyMessage="Henuz kalite plani yok."
        columns={[
          {
            key: "part_id",
            label: "Parca",
            render: (record) => partNames[record.part_id] || record.part_id,
          },
          { key: "criteria", label: "Kriter" },
          { key: "measurement_method", label: "Yontem" },
        ]}
      />

      <SectionCard
        title="Kalite Kayitlari"
        description="Giris kalite kontrol sonucunda mal kabul kaydi ve stok karantina durumu otomatik guncellenir."
      >
        <div className="record-manager">
          <form className="entity-form" onSubmit={submitRecord}>
            <InlineAlert kind="error" message={recordError} />
            <div className="form-grid">
              <FormField
                label="Kontrol Tipi"
                name="inspection_type"
                type="select"
                value={recordForm.inspection_type}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
                options={QUALITY_TYPES}
              />
              <FormField
                label="Parca"
                name="part_id"
                type="select"
                required
                value={recordForm.part_id}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(parts.records, (part) => partNames[part.id])}
              />
              <FormField
                label="Mal Kabul"
                name="goods_receipt_id"
                type="select"
                value={recordForm.goods_receipt_id}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
                options={toOptions(
                  goodsReceipts.records,
                  (receipt) => `${partNames[receipt.part_id] || receipt.part_id} / ${receipt.lot_number}`,
                )}
              />
              <FormField
                label="Operasyon"
                name="operation_name"
                value={recordForm.operation_name}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Sonuc"
                name="result"
                type="select"
                value={recordForm.result}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
                options={QUALITY_RESULTS}
              />
              <FormField
                label="Kontrol Tarihi"
                name="inspection_date"
                type="date"
                required
                value={recordForm.inspection_date}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Olcum Verisi"
                name="measurement_data"
                type="textarea"
                value={recordForm.measurement_data}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
              />
              <FormField
                label="Notlar"
                name="notes"
                type="textarea"
                value={recordForm.notes}
                onChange={(name, value) => setRecordForm((current) => ({ ...current, [name]: value }))}
              />
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kalite Kaydi Olustur"}
              </button>
            </div>
          </form>

          <DataTable
            records={records.records}
            emptyMessage="Henuz kalite kaydi yok."
            columns={[
              { key: "inspection_type", label: "Tip", render: (record) => <StatusBadge value={record.inspection_type} /> },
              { key: "part_id", label: "Parca", render: (record) => partNames[record.part_id] || record.part_id },
              { key: "inspection_date", label: "Tarih", render: (record) => formatDate(record.inspection_date) },
              { key: "result", label: "Sonuc", render: (record) => <StatusBadge value={record.result} /> },
            ]}
          />
        </div>
      </SectionCard>

      <RecordManager
        title="Uygunsuzluklar"
        description="Uygunsuzluk ve aksiyon yonetimi."
        fields={[
          {
            name: "part_id",
            label: "Parca",
            type: "select",
            required: true,
            options: toOptions(parts.records, (part) => partNames[part.id]),
          },
          { name: "source_type", label: "Kaynak", required: true },
          { name: "source_id", label: "Kayit ID" },
          { name: "description", label: "Aciklama", type: "textarea", required: true },
          { name: "action", label: "Aksiyon", type: "select", options: NONCONFORMITY_ACTIONS },
          { name: "status", label: "Durum" },
        ]}
        initialValues={{
          part_id: "",
          source_type: "",
          source_id: "",
          description: "",
          action: "rework",
          status: "open",
        }}
        onSubmit={(values) => createNonconformity(values, user?.uid)}
        submitLabel="Uygunsuzluk Kaydet"
        records={nonconformities.records}
        emptyMessage="Henuz uygunsuzluk yok."
        columns={[
          { key: "part_id", label: "Parca", render: (record) => partNames[record.part_id] || record.part_id },
          { key: "action", label: "Aksiyon", render: (record) => <StatusBadge value={record.action} /> },
          { key: "status", label: "Durum", render: (record) => <StatusBadge value={record.status} /> },
        ]}
      />
    </div>
  );
}
