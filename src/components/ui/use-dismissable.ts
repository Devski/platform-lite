import { useEffect, type RefObject } from "react";

// Closes an open popover (role="menu"/nav dropdown) on Escape or on a click
// outside its container — the interactions ARIA authoring practices expect
// from anything with role="menu", shared by AccountMenu and LanguageChip.
export function useDismissable(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, containerRef, onDismiss]);
}
