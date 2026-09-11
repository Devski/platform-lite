"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelReveal } from "@/components/ui/channel-reveal";
import { Icon } from "@/components/ui/icon";
import { OrbitCueButtons } from "@/components/ui/orbit-cues";
import { OrbitRing } from "@/components/ui/orbit-ring";
import { OrbitViewer } from "@/components/ui/orbit-viewer";
import { useOrbit, type Orbit } from "@/components/ui/use-orbit";
import { useFrameLoader } from "@/components/ui/use-frame-loader";
import { cuesInOrder } from "@/lib/r360/cues";
import {
  frameUrl,
  frameUrls,
  type R360Cue,
  type R360Params,
  type R360Width,
} from "@/lib/r360/frame-set-shared";
import type { OrbitParams } from "@/lib/r360/orbit";

// #72 / A12: a profile's works as cards — the main photo dominant (two
// thirds of the width and both rows, the other one or two beside it), the
// name, investor and developer as label/value pairs — and, on a click, the
// photo at its largest in a full-screen overlay with the arrows stepping
// through that work's photos (decision of 08.09.2026). The same component
// serves the visitor and the owner; the owner's page adds the edit/delete
// row and the R360 badge through props.

export interface GalleryImage {
  /** Present on the owner's page (the form needs it), absent for a visitor. */
  fileId?: string;
  url1600: string;
  url480: string;
  /** #99: the photo's second channel — shown by the reveal slider (#100);
   * until then the first channel is what the page shows. */
  secondary?: { fileId?: string; url1600: string; url480: string };
}

/** #104: the orbit a visitor turns — the parameters and where the frames are. */
export interface GalleryOrbit {
  /** The set the frames sit under; the owner's form names it on save. */
  setId: string;
  params: R360Params;
  frameBase: string;
}

export interface GalleryWork {
  id: string;
  name: string;
  investor: string | null;
  developer: string | null;
  images: GalleryImage[];
  /** The work's R360 as shown to everyone; its start frame is the poster. */
  orbit?: GalleryOrbit | null;
}

// #104: what the card shows and the lightbox steps through — the orbit
// first, when the work has one, then the photos, numbered from one among
// themselves. Both count the same way because both count this list.
type Picture =
  | { kind: "orbit"; orbit: GalleryOrbit }
  | { kind: "photo"; image: GalleryImage; number: number };

function picturesOf(work: GalleryWork): Picture[] {
  return [
    ...(work.orbit ? [{ kind: "orbit" as const, orbit: work.orbit }] : []),
    ...work.images.map((image, i) => ({
      kind: "photo" as const,
      image,
      number: i + 1,
    })),
  ];
}

const LIGHTBOX = "__lightbox";

/**
 * #107: the parameters the card's orbit hand gets when the work has no
 * orbit — the hook is called either way, and turns nothing then.
 */
const NO_ORBIT: OrbitParams = {
  frameCount: 2,
  direction: 1,
  framesPerWidth: 1,
  startFrame: 1,
};

/** #107: the cues of an orbit, and which one is pointed at — ring and buttons share both. */
interface CueHand {
  cues: readonly R360Cue[];
  preview: number | null;
  onPreview: (frame: number | null) => void;
}

/** #107: an orbit's cues in button order, and the shared pointed-at state. */
function useCueHand(params: R360Params | undefined): CueHand {
  const [preview, onPreview] = useState<number | null>(null);
  const cues = useMemo(
    () => (params ? cuesInOrder(params.cues, params) : []),
    [params],
  );
  return { cues, preview, onPreview };
}

function isLightboxState(state: unknown): boolean {
  return typeof state === "object" && state !== null && LIGHTBOX in state;
}

interface Lightbox {
  work: GalleryWork;
  index: number;
  /** The photo button that opened it, to give focus back to. */
  returnTo: HTMLElement | null;
}

export function WorksGallery({
  works,
  owner,
  inPlace,
  onEdit,
  onDelete,
}: {
  works: GalleryWork[];
  /** The owner's view: R360 badges and the edit/delete row (when editing). */
  owner?: { editing: boolean };
  /** #86: the work being edited shows its form where its card was, the
   * others stay put — three cards for two works was the wrong picture. */
  inPlace?: { workId: string; form: ReactNode };
  onEdit?: (work: GalleryWork) => void;
  onDelete?: (work: GalleryWork) => Promise<boolean>;
}) {
  const t = useTranslations("Works");
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  // #84: on a phone, back is the gesture for "close this picture", and it
  // used to leave the site. Opening pushes a history entry marked as the
  // lightbox's; back pops it and closes the picture, the page stays.
  // Closing by the button or Escape pops that entry itself, so the next
  // back goes where it always went. Stepping between photos adds nothing.
  // The editing guard (#83) ignores this pop: the entry it lands on still
  // carries its own marker, which rides along in the pushed state.
  const lightboxRef = useRef<Lightbox | null>(null);
  const pushed = useRef(false);
  function commitLightbox(next: Lightbox | null) {
    lightboxRef.current = next;
    setLightbox(next);
  }
  function openLightbox(next: Lightbox) {
    commitLightbox(next);
    if (!pushed.current) {
      window.history.pushState(
        { ...(window.history.state as object | null), [LIGHTBOX]: true },
        "",
      );
      pushed.current = true;
    }
  }
  function closeLightbox() {
    lightboxRef.current?.returnTo?.focus();
    commitLightbox(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  }
  useEffect(() => {
    // "pushed" means "the page is on the lightbox's entry": after a reload
    // with the picture open, or a forward back onto the entry, the next
    // opening reuses it rather than pushing a second one (#84 review).
    pushed.current = isLightboxState(window.history.state);
    function onPop(event: PopStateEvent) {
      const onEntry = isLightboxState(event.state);
      // The entry the lightbox pushed was left by back: close, without a
      // back of our own.
      if (pushed.current && !onEntry) {
        lightboxRef.current?.returnTo?.focus();
        commitLightbox(null);
      }
      pushed.current = onEntry;
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <ul className="grid grid-cols-1 gap-(--sp-5) sm:grid-cols-2">
        {works.map((work) =>
          inPlace?.workId === work.id ? (
            <li key={work.id} className="flex sm:col-span-2">
              {inPlace.form}
            </li>
          ) : (
            <li key={work.id} className="flex">
              <WorkCard
                // #107: the card holds the hand on its orbit, which starts
                // on the start frame once — a set the work did not have
                // (an orbit added to a photos-only work) gets a new card.
                key={work.orbit?.setId ?? "no-orbit"}
                work={work}
                owner={owner}
                onOpen={(index, returnTo) =>
                  openLightbox({ work, index, returnTo })
                }
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </li>
          ),
        )}
      </ul>
      {lightbox && (
        <LightboxOverlay
          work={lightbox.work}
          index={lightbox.index}
          onStep={(index) => commitLightbox({ ...lightbox, index })}
          onClose={closeLightbox}
          label={t("lightbox.label")}
        />
      )}
    </>
  );
}

function WorkCard({
  work,
  owner,
  onOpen,
  onEdit,
  onDelete,
}: {
  work: GalleryWork;
  owner?: { editing: boolean };
  onOpen: (index: number, returnTo: HTMLElement | null) => void;
  onEdit?: (work: GalleryWork) => void;
  onDelete?: (work: GalleryWork) => Promise<boolean>;
}) {
  const t = useTranslations("Works");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  // The strip shows three pictures at most — an orbit and three photos
  // (A12 allows both) would break its two-row grid; the fourth is in
  // the lightbox, one arrow away (#104 review).
  const pictures = picturesOf(work).slice(0, 3);
  const count = pictures.length;
  // #107: the tile and its cue buttons under the strip turn one orbit, so
  // the hand on it lives here, above both.
  const hand = useOrbit(work.orbit?.params ?? NO_ORBIT);
  const cueHand = useCueHand(work.orbit?.params);

  return (
    <Card
      as="article"
      padding="none"
      className="flex w-full flex-col overflow-hidden"
    >
      {/* The main picture takes both rows and two thirds of the width; the
          others stack beside it. Alone, it takes the whole strip. */}
      <div
        className={`grid gap-[2px] bg-(--border-hairline) ${
          count <= 1 ? "grid-cols-1" : "grid-cols-[2fr_1fr] grid-rows-2"
        }`}
      >
        {count === 0 && (
          <div
            className="flex aspect-[16/9] items-center justify-center bg-(--surface-sunken) type-eyebrow text-(--text-muted)"
            data-testid="work-card-no-photo"
          >
            {t("card.orbit")}
          </div>
        )}
        {pictures.map((picture, index) => {
          const tile =
            index === 0
              ? count === 1
                ? "aspect-[16/9]"
                : "row-span-2 aspect-[4/3]"
              : count === 2
                ? "row-span-2"
                : "aspect-[4/3]";
          if (picture.kind === "orbit") {
            return (
              <OrbitTile
                key="orbit"
                name={work.name}
                orbit={picture.orbit}
                hand={hand}
                cueHand={cueHand}
                className={tile}
                onOpen={(returnTo) => onOpen(index, returnTo)}
              />
            );
          }
          const { image, number } = picture;
          return (
            <button
              key={image.url1600}
              type="button"
              onClick={(event) => onOpen(index, event.currentTarget)}
              // The badge is inside the button, whose label replaces its
              // content for the screen reader: the two channels are named here.
              aria-label={`${t("card.enlarge", {
                index: picture.number,
                count: work.images.length,
                name: work.name,
              })}${image.secondary ? `, ${t("reveal.badge")}` : ""}`}
              className={`relative block min-h-0 cursor-zoom-in overflow-hidden bg-n-200 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--surface-card),inset_0_0_0_5px_var(--focus-ring)] ${tile}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url480}
                srcSet={`${image.url480} 480w, ${image.url1600} 1600w`}
                sizes={
                  index === 0 ? "(max-width: 640px) 100vw, 30rem" : "12rem"
                }
                alt={t("photoAlt", { name: work.name, index: number })}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {image.secondary && (
                <span
                  className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-n-950/80 px-2 py-0.5 type-eyebrow text-white"
                  title={t("reveal.badge")}
                  aria-hidden="true"
                >
                  <Icon name="layers" size={12} />
                  <span className="sr-only">{t("reveal.badge")}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-1 flex-col gap-(--sp-3) p-(--sp-5) sm:px-(--sp-6) sm:pb-(--sp-6)">
        {work.orbit && (
          <OrbitCueButtons
            cues={cueHand.cues}
            orbit={hand}
            params={work.orbit.params}
            preview={cueHand.preview}
            onPreview={cueHand.onPreview}
            label={t("orbit.cues", { name: work.name })}
          />
        )}
        <h3 className="type-h3 break-words text-(--text-strong)">
          {work.name}
        </h3>
        {(work.investor || work.developer) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-(--sp-5) gap-y-(--sp-1) type-sm">
            {work.investor && (
              <>
                <dt className="text-(--text-muted)">{t("card.investor")}</dt>
                <dd className="text-(--text-body)">{work.investor}</dd>
              </>
            )}
            {work.developer && (
              <>
                <dt className="text-(--text-muted)">{t("card.developer")}</dt>
                <dd className="text-(--text-body)">{work.developer}</dd>
              </>
            )}
          </dl>
        )}
        {deleteFailed && (
          <p className="type-sm text-(--state-danger)" role="alert">
            {t("card.deleteFailed")}
          </p>
        )}
        {owner && (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-(--sp-3) pt-(--sp-2)">
            {/* Whether the work has an orbit at all, for the owner's own
                glance down the list. */}
            <Badge uppercase tone={work.orbit ? "success" : "neutral"}>
              {work.orbit ? t("card.r360Ready") : t("card.r360None")}
            </Badge>
            {owner.editing && onEdit && onDelete && (
              <div className="flex flex-wrap items-center gap-(--sp-3)">
                {confirming ? (
                  <>
                    <span className="type-sm text-(--text-muted)">
                      {t("card.confirmDelete")}
                    </span>
                    <Button
                      variant="quiet"
                      className="text-(--state-danger)"
                      disabled={deleting}
                      ref={confirmRef}
                      onClick={async () => {
                        setDeleting(true);
                        setDeleteFailed(false);
                        const done = await onDelete(work);
                        if (!done) {
                          setDeleting(false);
                          setConfirming(false);
                          setDeleteFailed(true);
                        }
                      }}
                    >
                      {deleting ? t("card.deleting") : t("card.confirmYes")}
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={deleting}
                      onClick={() => setConfirming(false)}
                    >
                      {t("card.confirmNo")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="quiet"
                      onClick={() => onEdit(work)}
                      data-work-edit={work.id}
                      aria-label={`${t("card.edit")}: ${work.name}`}
                    >
                      {t("card.edit")}
                    </Button>
                    <Button
                      variant="quiet"
                      className="text-(--state-danger)"
                      onClick={() => setConfirming(true)}
                      aria-label={`${t("card.delete")}: ${work.name}`}
                    >
                      {t("card.delete")}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// The photo at its largest (the 1600 px variant — the original stays
// private, G3), one at a time, on a dark ground. Esc closes; the arrows,
// on screen and on the keyboard, step through the work's photos.
function LightboxOverlay({
  work,
  index,
  onStep,
  onClose,
  label,
}: {
  work: GalleryWork;
  index: number;
  onStep: (index: number) => void;
  onClose: () => void;
  label: string;
}) {
  const t = useTranslations("Works");
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pictures = picturesOf(work);
  const count = pictures.length;
  const step = (delta: number) => onStep((index + delta + count) % count);

  // Focus goes to Close once, when the overlay opens — not on every step,
  // or the arrows would lose focus the moment they are used.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  // A step takes away what it steps from — an orbit's cue buttons with it
  // (#107 review) — and a focus that went with them comes back to Close,
  // not to the page behind the dialog.
  useEffect(() => {
    if (!rootRef.current?.contains(document.activeElement)) {
      closeRef.current?.focus();
    }
  }, [index]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        // A modal keeps the focus: Tab cycles through its own controls and
        // never reaches the page behind it (#84 review) — where "Zapisz"
        // or another card's button would move history under the picture.
        const controls = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>(
            "button, [role=slider]",
          ) ?? [],
        );
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (
          event.shiftKey &&
          (active === first || !rootRef.current?.contains(active))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (active === last || !rootRef.current?.contains(active))
        ) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") onClose();
      // The reveal slider (#100) has the arrows while it holds the focus.
      else if ((event.target as Element | null)?.closest?.("[role=slider]"))
        return;
      else if (event.key === "ArrowLeft" && count > 1) step(-1);
      else if (event.key === "ArrowRight" && count > 1) step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // step closes over index; re-binding per index is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  const picture: Picture | undefined = pictures[index];
  const control =
    "absolute flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(12,17,22,.6),0_0_0_4px_#fff]";

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // Scrolls when what it holds is taller than the screen — an orbit
      // with a dozen cue buttons on a short one (#107 review). Safe
      // centring keeps the top reachable when it does.
      className="fixed inset-0 z-50 flex flex-col items-center justify-center-safe overflow-y-auto bg-n-950 px-(--sp-5) py-(--sp-8)"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("lightbox.close")}
        className={`${control} top-(--sp-5) right-(--sp-5)`}
      >
        <Icon name="x" size={18} />
      </button>
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={t("lightbox.prev")}
            className={`${control} top-1/2 left-(--sp-5) -translate-y-1/2`}
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={t("lightbox.next")}
            className={`${control} top-1/2 right-(--sp-5) -translate-y-1/2`}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </>
      )}
      {picture?.kind === "orbit" ? (
        <OrbitFull name={work.name} orbit={picture.orbit} />
      ) : picture?.kind !== "photo" ? null : picture.image.secondary ? (
        // #100: two channels — the second revealed under the first by the
        // slider, along the picture or across it.
        <ChannelReveal
          key={picture.image.url1600}
          first={{
            src: picture.image.url1600,
            alt: t("photoAlt", { name: work.name, index: picture.number }),
          }}
          second={{
            src: picture.image.secondary.url1600,
            alt: t("reveal.secondAlt", {
              name: work.name,
              index: picture.number,
            }),
          }}
          label={t("reveal.label", { name: work.name, index: picture.number })}
          imageClassName="max-h-[calc(100vh-180px)] max-w-[min(96vw,1600px)] object-contain"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={picture.image.url1600}
          alt={t("photoAlt", { name: work.name, index: picture.number })}
          className="max-h-[calc(100vh-140px)] max-w-[min(96vw,1600px)] object-contain"
        />
      )}
      <p className="mt-(--sp-5) flex items-center gap-(--sp-5) type-sm text-n-300">
        <span className="font-medium text-white">{work.name}</span>
        <span className="font-mono tabular-nums">
          {t("lightbox.counter", { index: index + 1, count })}
        </span>
        <span className="hidden sm:inline">{t("lightbox.hint")}</span>
      </p>
    </div>
  );
}

// #104: the visitor's orbit at one width — the frames loading coarse to
// fine from the start frame, which the server renders as the poster (a
// plain <img>, so the page has a picture without JavaScript and for
// crawlers). The card and the lightbox both stand on this.
function PublicOrbit({
  name,
  orbit,
  hand,
  cueHand,
  width,
  label,
  className,
  imageClassName,
  enabled,
  posterSrc,
  ring,
}: {
  name: string;
  orbit: GalleryOrbit;
  /** The hand on the orbit: its owner shares it with the cue buttons. */
  hand: Orbit;
  cueHand: CueHand;
  width: R360Width;
  label: string;
  className: string;
  imageClassName: string;
  /** Fetch frames at all — once the picture is in view. */
  enabled: boolean;
  posterSrc?: string;
  /** #106: the ring over the picture's foot, or below the picture. */
  ring: "overlay" | "below";
}) {
  const t = useTranslations("Works");
  const urls = useMemo(
    () => frameUrls(orbit.frameBase, width, orbit.params.frameCount),
    [orbit.frameBase, width, orbit.params.frameCount],
  );
  const { loaded, pictures } = useFrameLoader(urls, orbit.params.startFrame, {
    enabled,
  });
  const dial = (
    <OrbitRing
      orbit={hand}
      params={orbit.params}
      loaded={loaded}
      flattening={orbit.params.flattening}
      className={
        // Over the card's other marks: the translate makes the ring a layer
        // of its own, and a cue's label in it would sit under the enlarge
        // button otherwise (#107 review). A phone shows no ring at all, on
        // the card or in the lightbox — only the cue buttons (#107).
        ring === "overlay"
          ? "absolute bottom-1 left-1/2 z-10 w-[38%] max-w-40 -translate-x-1/2 phone:hidden"
          : "mt-(--sp-3) w-40 phone:hidden"
      }
      // In the lightbox the caption counts the pictures right under it.
      counter={ring === "overlay"}
      cues={cueHand.cues}
      cuePreview={cueHand.preview}
      onCuePreview={cueHand.onPreview}
    />
  );
  return (
    <div
      className={ring === "below" ? "flex flex-col items-center" : "contents"}
    >
      <OrbitViewer
        pictures={pictures}
        poster={orbit.params.startFrame}
        // The card renders its own start frame server-side; the lightbox
        // is handed the card's cached 800 px one (#104 review).
        posterSrc={posterSrc ?? urls[orbit.params.startFrame - 1]}
        params={orbit.params}
        orbit={hand}
        alt={t("orbit.frameAlt", { name })}
        label={label}
        className={className}
        imageClassName={imageClassName}
      />
      {dial}
    </div>
  );
}

/**
 * Whether the element is at least half in view (#104 review): the frames
 * of a tile below the fold wait for the visitor to scroll to it. True at
 * once where there is no observer (an old browser; the server).
 */
function useInView(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  // Without an observer (an old browser) the tile counts as in view; the
  // server answers false, and nothing rendered depends on it.
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

/** The page's own pictures first: frames wait for the load event. */
/**
 * Whether the page has finished loading — the orbits wait for it so their
 * frames never compete with the page's own pictures.
 *
 * Through `useSyncExternalStore` rather than an effect that subscribes,
 * because the state and the subscription have to be settled TOGETHER. As
 * an effect it was a race: the initial state is read during hydration,
 * when the document is usually still loading, and the effect runs a tick
 * later — on a warm cache `load` fires in between, the listener is
 * attached to an event that has already happened, and it never arrives.
 * `enabled` then stays false for good and the orbit shows its poster and
 * nothing else. Reported by Dawid on 10.09.2026: "przeładowałem stronę i
 * nie ładują się inne klatki, poza pierwszą" — a reload, with everything
 * already in cache, which is exactly when the race is lost.
 *
 * React re-reads the snapshot after subscribing, so a `load` that beat the
 * subscription is caught rather than waited for.
 */
function usePageLoaded(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (document.readyState === "complete") return () => {};
      window.addEventListener("load", onChange, { once: true });
      return () => window.removeEventListener("load", onChange);
    },
    () => document.readyState === "complete",
    // On the server there is no document, and nothing to fetch anyway.
    () => false,
  );
}

// The orbit on the card, a drag across the picture turning it. The
// picture is the control, so the way into the lightbox is a button of
// its own beside the 360° mark.
function OrbitTile({
  name,
  orbit,
  hand,
  cueHand,
  className,
  onOpen,
}: {
  name: string;
  orbit: GalleryOrbit;
  hand: Orbit;
  cueHand: CueHand;
  className: string;
  onOpen: (returnTo: HTMLElement | null) => void;
}) {
  const t = useTranslations("Works");
  const [ref, inView] = useInView();
  const pageLoaded = usePageLoaded();
  return (
    <div
      ref={ref}
      className={`relative min-h-0 overflow-hidden bg-n-200 ${className}`}
      // #107: a cue's label on the ring stays inside the picture, which
      // clips whatever leaves it.
      data-orbit-bounds
    >
      <PublicOrbit
        name={name}
        orbit={orbit}
        hand={hand}
        cueHand={cueHand}
        width={800}
        label={t("orbit.cardLabel", { name })}
        className="h-full w-full"
        imageClassName="object-cover"
        enabled={inView && pageLoaded}
        ring="overlay"
      />
      <span
        className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-n-950 px-2 py-0.5 type-eyebrow text-white"
        aria-hidden="true"
      >
        {t("orbit.mark")}
      </span>
      <button
        type="button"
        onClick={(event) => onOpen(event.currentTarget)}
        aria-label={t("orbit.enlarge", { name })}
        title={t("orbit.enlarge", { name })}
        className="absolute right-1.5 bottom-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-n-950/80 text-white hover:bg-n-950 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--surface-card),0_0_0_4px_var(--focus-ring)]"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

// The orbit at its largest in the lightbox: the 1600 px set on a wide
// screen, the 800 px one on a phone.
function OrbitFull({ name, orbit }: { name: string; orbit: GalleryOrbit }) {
  const t = useTranslations("Works");
  const [width] = useState<R360Width>(() =>
    typeof window !== "undefined" && window.innerWidth > 900 ? 1600 : 800,
  );
  const hand = useOrbit(orbit.params);
  const cueHand = useCueHand(orbit.params);
  // The ring under the picture takes its band out of the height (#106
  // review), and the cue buttons under the ring two rows more (#107); a
  // phone shows no ring, so there only the buttons do. Never below 10rem,
  // though: on a phone held sideways the sum leaves nothing, and the dialog
  // scrolls instead of losing the picture.
  const height =
    cueHand.cues.length > 0
      ? "max-h-[max(10rem,calc(100vh-140px-17rem))] phone:max-h-[max(10rem,calc(100vh-140px-5rem))]"
      : "max-h-[max(10rem,calc(100vh-140px-12rem))] phone:max-h-[max(10rem,calc(100vh-140px))]";
  return (
    <div className="flex flex-col items-center">
      <PublicOrbit
        name={name}
        orbit={orbit}
        hand={hand}
        cueHand={cueHand}
        width={width}
        label={t("orbit.lightboxLabel", { name })}
        className={`flex ${height} w-[min(96vw,1600px)] items-center justify-center`}
        imageClassName={`${height} object-contain`}
        enabled
        // The card's 800 px start frame is in the cache already: painted at
        // once, while the larger set is on its way.
        posterSrc={frameUrl(orbit.frameBase, 800, orbit.params.startFrame)}
        ring="below"
      />
      <OrbitCueButtons
        cues={cueHand.cues}
        orbit={hand}
        params={orbit.params}
        preview={cueHand.preview}
        onPreview={cueHand.onPreview}
        label={t("orbit.cues", { name })}
        tone="dark"
        className="mt-(--sp-4) max-w-[min(96vw,48rem)] justify-center"
      />
    </div>
  );
}
