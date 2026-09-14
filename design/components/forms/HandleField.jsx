import React from "react";
import { Input } from "./Input";
import { FormField } from "./FormField";
import { Badge } from "../core/Badge";

const STATE_COPY = {
  idle: null,
  checking: ["neutral", "checking…"],
  available: ["success", "free"],
  taken: ["danger", "taken"],
  reserved: ["warning", "reserved"],
  own: ["neutral", "yours"],
  invalid: ["danger", "invalid"],
};

export function HandleField({
  label = "Profile address",
  origin = "architektow3d.pl",
  value = "",
  onChange,
  state = "idle",
  message,
  hint,
  id = "handle",
  style,
}) {
  const chip = STATE_COPY[state];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", ...style }}>
      <FormField
        label={label}
        htmlFor={id}
        hint={hint}
        error={state === "taken" || state === "invalid" ? message : undefined}
        status={state === "checking" || state === "available" || state === "own" || state === "reserved" ? message : undefined}
      >
        <Input
          id={id}
          mono
          prefix={origin + "/"}
          value={value}
          onChange={onChange}
          invalid={state === "taken" || state === "invalid"}
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        <span style={{ font: "var(--type-eyebrow)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase", color: "var(--text-subtle)" }}>
          Your address
        </span>
        <span style={{ font: "var(--type-mono)", color: "var(--text-strong)" }}>
          {origin}/{value || "…"}
        </span>
        {chip ? <Badge tone={chip[0]}>{chip[1]}</Badge> : null}
      </div>
    </div>
  );
}
