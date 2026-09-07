import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "./icon";

type IconName = ComponentPropsWithoutRef<typeof Icon>["name"];

export function IconButton({
  icon,
  label,
  pressed,
  className = "",
  ...rest
}: ComponentPropsWithoutRef<"button"> & {
  icon: IconName;
  label: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex h-9 w-9 items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)] ${
        pressed
          ? "border-(--action-solid) bg-(--surface-sunken) text-(--text-strong)"
          : "border-(--border-default) text-(--text-body) hover:bg-(--surface-hover)"
      } ${className}`}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
