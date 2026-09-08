import { forwardRef, type ComponentPropsWithoutRef } from "react";

// The multi-line sibling of Input: same border, radius, focus and disabled
// treatment, sized by rows rather than the control height. Vertical resize
// only — a field that could grow sideways would leave its column.
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`rounded-sm border border-(--border-default) bg-(--surface-card) px-(--control-pad-x) py-(--sp-4) type-body text-(--text-strong) placeholder:text-(--text-subtle) focus:border-(--action-solid) focus:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:bg-(--surface-sunken) disabled:text-(--text-subtle) resize-y ${className}`}
      {...rest}
    />
  );
});
