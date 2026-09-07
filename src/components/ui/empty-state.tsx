import type { ComponentPropsWithoutRef } from "react";
import { Icon } from "./icon";

type IconName = ComponentPropsWithoutRef<typeof Icon>["name"];

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-(--sp-3) rounded-md border border-(--border-hairline) bg-(--surface-card) p-(--sp-10) text-center">
      <Icon name={icon} size={28} className="text-(--text-subtle)" />
      <p className="type-label text-(--text-strong)">{title}</p>
      <p className="type-sm max-w-[24rem] text-(--text-muted)">{body}</p>
    </div>
  );
}
