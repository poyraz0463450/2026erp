import { useMemo, useState } from "react";

import { DataTable } from "./DataTable";
import { FormField } from "./FormField";
import { InlineAlert } from "./InlineAlert";
import { SectionCard } from "./SectionCard";

const normalizeValues = (fields, values) =>
  fields.reduce((accumulator, field) => {
    const value = values[field.name];

    if (field.type === "number") {
      accumulator[field.name] = value === "" ? "" : Number(value);
      return accumulator;
    }

    accumulator[field.name] = value;
    return accumulator;
  }, {});

export function RecordManager({
  title,
  description,
  fields,
  initialValues,
  onSubmit,
  submitLabel = "Kaydet",
  records,
  columns,
  emptyMessage,
  note,
}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const renderedFields = useMemo(() => fields, [fields]);

  const handleChange = (name, nextValue) => {
    setValues((current) => ({ ...current, [name]: nextValue }));
  };

  const resetForm = () => {
    setValues(initialValues);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const missingField = renderedFields.find((field) => {
      if (!field.required) {
        return false;
      }

      const value = values[field.name];
      return value === undefined || value === null || value === "";
    });

    if (missingField) {
      setError(`${missingField.label} alani zorunludur.`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSubmit(normalizeValues(renderedFields, values));
      resetForm();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title={title} description={description} footer={note}>
      <div className="record-manager">
        <form className="entity-form" onSubmit={handleSubmit}>
          <InlineAlert kind="error" message={error} />
          <div className="form-grid">
            {renderedFields.map((field) => (
              <FormField
                key={field.name}
                {...field}
                value={values[field.name]}
                onChange={handleChange}
              />
            ))}
          </div>
          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Kaydediliyor..." : submitLabel}
            </button>
            <button className="button button--ghost" type="button" onClick={resetForm} disabled={saving}>
              Temizle
            </button>
          </div>
        </form>
        <DataTable columns={columns} records={records} emptyMessage={emptyMessage} />
      </div>
    </SectionCard>
  );
}
