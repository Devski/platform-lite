"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// #83: while the owner is editing, leaving the page asks first. Three ways
// out, three guards:
//
// - a reload, a closed tab, a typed address: `beforeunload`, the browser's
//   own dialog (it will not show ours);
// - back and forward: entering editing pushes a history entry marked as
//   ours; when that entry is left, the page is still on screen (same URL)
//   and our dialog asks. Stay steps forward onto the entry again; leave
//   releases the editing and goes back once more, to where the owner was
//   heading. An entry pushed above ours (the lightbox, #84) pops without a
//   word: the marker is still on the entry we land on;
// - a link in the app: a capturing click listener asks, then navigates.
//
// The entry is taken off the stack when editing ends normally ("Zapisz"),
// so a later back leaves the page as it always did.

const GUARD = "__leaveGuard";

type Guard = {
  active: boolean;
  /** Leaving was confirmed: the next pop off our entry is not questioned. */
  leaving: boolean;
  /** Runs on the next popstate — the pop we caused ourselves. */
  afterPop: (() => void) | null;
};

function isGuardState(state: unknown): boolean {
  return typeof state === "object" && state !== null && GUARD in state;
}

export function useLeaveGuard(active: boolean, onRelease: () => void) {
  const router = useRouter();
  // The action the owner is about to confirm, or nothing to confirm.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = useRef<Guard>({
    active: false,
    leaving: false,
    afterPop: null,
  });
  const release = useRef(onRelease);
  useEffect(() => {
    release.current = onRelease;
  });

  // One popstate listener for the hook's life: it must outlive an
  // activation, because the pop that removes our entry arrives after the
  // activation's cleanup ran.
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      const g = guard.current;
      if (g.afterPop) {
        const run = g.afterPop;
        g.afterPop = null;
        run();
        return;
      }
      if (!g.active || g.leaving || isGuardState(event.state)) return;
      // Our entry was left by back (or forward): ask.
      setPending(() => () => {
        g.leaving = true;
        release.current();
        window.history.back();
      });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!active) return;
    const g = guard.current;
    g.active = true;
    g.leaving = false;
    // Next keeps its own fields on history.state; they ride along so its
    // router recognises the entry as one of its pages.
    window.history.pushState(
      { ...(window.history.state as object | null), [GUARD]: true },
      "",
    );

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers still read this.
      event.returnValue = "";
    }
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      // Another site: beforeunload has it. This page: nothing to leave.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const target = url.pathname + url.search + url.hash;
      setPending(() => () => {
        g.leaving = true;
        // Editing ends, the cleanup below pops our entry, and the page
        // moves on once that pop has landed — a tick later: Next's own
        // popstate handler restores this page in the same task, and a
        // push issued inside it is lost to that restore.
        g.afterPop = () => setTimeout(() => router.push(target), 0);
        release.current();
      });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      g.active = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      setPending(null);
      if (isGuardState(window.history.state)) {
        // Still on our entry: take it off the stack. That pop is ours.
        if (!g.afterPop) g.afterPop = () => undefined;
        window.history.back();
      } else {
        // Already off it (left by back): whatever was queued runs now.
        const run = g.afterPop;
        g.afterPop = null;
        run?.();
      }
    };
  }, [active, router]);

  function stay() {
    setPending(null);
    // Left by back: step onto our entry again. Its state carries the
    // marker, so the pop it causes asks nothing.
    if (!isGuardState(window.history.state)) window.history.forward();
  }

  return { pending, stay };
}
