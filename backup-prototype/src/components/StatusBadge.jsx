import { STATUS_LABELS } from "../constants/statuses";
import { titleCase } from "../utils/format";

export function StatusBadge({ value, label }) {
  const displayValue =
    label || STATUS_LABELS[value] || (value ? titleCase(value) : "Bilinmiyor");
  return <span className={`status-badge status-badge--${value}`}>{displayValue}</span>;
}
