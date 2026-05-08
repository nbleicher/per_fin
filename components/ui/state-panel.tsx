export function StatePanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--line)",
        borderRadius: 12,
        padding: "1.2rem",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, lineHeight: "var(--leading-snug, 1.42)" }}>{title}</p>
      <p
        style={{
          margin: "0.5rem 0 0",
          color: "var(--text-muted)",
          lineHeight: "var(--leading-body, 1.72)",
        }}
      >
        {message}
      </p>
    </div>
  );
}
