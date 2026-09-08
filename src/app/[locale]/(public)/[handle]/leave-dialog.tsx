"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

// #83: the question asked before the owner leaves the page mid-edit. Stay
// is the safe answer, so it holds focus and answers Escape.
export function LeaveDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("Settings.profile.leave");
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);

  // Focus once, on opening — not again on a parent's render (an upload
  // landing while the dialog is up must not pull focus off "Wyjdź").
  useEffect(() => {
    if (open) stayRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onStay();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onStay]);

  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onStay();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,17,22,0.6)] px-(--sp-5)"
    >
      <div className="flex w-full max-w-md flex-col gap-(--sp-5) rounded-md border border-(--border-hairline) bg-(--surface-card) p-(--sp-6) shadow-(--shadow-lift)">
        <h2 id={titleId} className="type-h3 text-(--text-strong)">
          {t("title")}
        </h2>
        <p id={bodyId} className="type-body text-(--text-body)">
          {t("body")}
        </p>
        <div className="flex flex-wrap justify-end gap-(--sp-3)">
          <Button variant="quiet" onClick={onLeave}>
            {t("leave")}
          </Button>
          <Button ref={stayRef} onClick={onStay}>
            {t("stay")}
          </Button>
        </div>
      </div>
    </div>
  );
}
