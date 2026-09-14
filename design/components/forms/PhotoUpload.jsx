import React from "react";
import { Avatar } from "../core/Avatar";
import { Button } from "../core/Button";

export function PhotoUpload({
  src,
  name = "",
  size = 128,
  emptyLabel = "You have no profile photo yet.",
  chooseLabel = "Choose a photo",
  hint = "JPEG, PNG or WebP, up to 10 MB. We crop it to a square.",
  busy = false,
  busyLabel = "Uploading and processing…",
  onChoose,
  style,
}) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-7)", alignItems: "flex-start", flexWrap: "wrap", ...style }}>
      <Avatar src={src} name={name} size={size} alt={src ? "Your current profile photo" : undefined} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", minWidth: 0, flex: 1 }}>
        {!src ? <p style={{ font: "var(--type-sm)", color: "var(--text-muted)", margin: 0 }}>{emptyLabel}</p> : null}
        <Button variant="quiet" onClick={onChoose} disabled={busy}>{chooseLabel}</Button>
        <p style={{ font: "var(--type-sm)", color: "var(--text-subtle)", margin: 0 }}>{busy ? busyLabel : hint}</p>
      </div>
    </div>
  );
}
