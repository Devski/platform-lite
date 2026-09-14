import React from "react";

export function Input({
  value,
  onChange,
  type = "text",
  invalid = false,
  disabled = false,
  mono = false,
  size = "md",
  prefix,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const border = invalid
    ? "var(--state-danger)"
    : focus
      ? "var(--n-950)"
      : "var(--border-default)";
  const field = (
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...(prefix ? { flex: 1, minWidth: 0 } : { width: "100%", flex: "none" }),
        height: size === "lg" ? "var(--field-h-lg)" : "var(--field-h)",
        padding: prefix ? "0 var(--sp-5) 0 0" : "0 var(--sp-5)",
        border: prefix ? "none" : "1px solid " + border,
        borderRadius: prefix ? 0 : "var(--radius-control)",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
        color: "var(--text-strong)",
        font: mono ? "var(--type-mono)" : "var(--type-body)",
        outline: "none",
        transition: "var(--transition-control)",
        ...(prefix ? null : style),
      }}
      {...rest}
    />
  );
  if (!prefix) return field;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: "1px solid " + border,
        borderRadius: "var(--radius-control)",
        background: disabled ? "var(--surface-sunken)" : "var(--surface-card)",
        transition: "var(--transition-control)",
        ...style,
      }}
    >
      <span
        style={{
          padding: "0 var(--sp-1) 0 var(--sp-5)",
          font: "var(--type-mono)",
          color: "var(--text-subtle)",
          whiteSpace: "nowrap",
        }}
      >
        {prefix}
      </span>
      {field}
    </div>
  );
}
