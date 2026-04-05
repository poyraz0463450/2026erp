export function SectionCard({ title, description, children, footer }) {
  return (
    <section className="section-card">
      {(title || description) && (
        <div className="section-card__header">
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </div>
      )}
      <div className="section-card__body">{children}</div>
      {footer ? <div className="section-card__footer">{footer}</div> : null}
    </section>
  );
}
