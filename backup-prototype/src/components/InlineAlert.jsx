export function InlineAlert({ kind = "info", message }) {
  if (!message) {
    return null;
  }

  return <div className={`inline-alert inline-alert--${kind}`}>{message}</div>;
}
