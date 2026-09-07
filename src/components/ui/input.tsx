import { forwardRef, type ComponentPropsWithoutRef } from "react";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  mono?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono = false, className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`h-(--field-h) rounded-sm border border-(--border-default) bg-(--surface-card) px-(--control-pad-x) type-body text-(--text-strong) placeholder:text-(--text-subtle) focus:border-(--action-solid) focus:outline-none focus-visible:shadow-[var(--ring-focus)] disabled:bg-(--surface-sunken) disabled:text-(--text-subtle) ${mono ? "font-mono" : ""} ${className}`}
      {...rest}
    />
  );
});
