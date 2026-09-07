import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  hint,
  hintId,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-(--field-gap)">
      <label htmlFor={htmlFor} className="type-label text-(--text-body)">
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="type-sm text-(--text-muted)">
          {hint}
        </p>
      )}
    </div>
  );
}
