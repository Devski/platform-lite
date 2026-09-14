import React from "react";

export function FormField({ label, htmlFor, hint, error, status, children, style, ...rest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--field-gap)", ...style }} {...rest}>
      {label ? (
        <label htmlFor={htmlFor} style={{ font: "var(--type-label)", color: "var(--text-body)" }}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" style={{ font: "var(--type-sm)", color: "var(--state-danger)", margin: 0 }}>{error}</p>
      ) : null}
      {!error && status ? (
        <p role="status" style={{ font: "var(--type-sm)", color: "var(--text-muted)", margin: 0 }}>{status}</p>
      ) : null}
      {hint ? (
        <p style={{ font: "var(--type-sm)", color: "var(--text-subtle)", margin: 0 }}>{hint}</p>
      ) : null}
    </div>
  );
}
