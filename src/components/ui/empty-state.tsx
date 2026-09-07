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
    // 48px of padding all round is a sixth of a 360px screen; below sm it
    // drops one stop on the 4px scale, the same step Card takes.
    <div className="flex flex-col items-center gap-(--sp-3) rounded-md border border-(--border-hairline) bg-(--surface-card) p-(--sp-8) text-center sm:p-(--sp-10)">
      <Icon name={icon} size={28} className="text-(--text-subtle)" />
      <p className="type-label text-(--text-strong)">{title}</p>
      <p className="type-sm max-w-[24rem] text-(--text-muted)">{body}</p>
    </div>
  );
}
