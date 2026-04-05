export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  options = [],
  required = false,
  min,
  step,
  rows = 3,
  disabled = false,
}) {
  const commonProps = {
    id: name,
    name,
    value: value ?? "",
    onChange: (event) => onChange(name, event.target.value),
    placeholder,
    required,
    disabled,
    min,
    step,
  };

  return (
    <label className="form-field">
      <span className="form-field__label">
        {label}
        {required ? " *" : ""}
      </span>
      {type === "textarea" ? (
        <textarea {...commonProps} rows={rows} />
      ) : type === "select" ? (
        <select {...commonProps}>
          <option value="">Seciniz</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...commonProps} type={type} />
      )}
    </label>
  );
}
