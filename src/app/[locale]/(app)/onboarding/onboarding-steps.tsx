"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { handleBaseFrom } from "@/lib/handle";
import { DISPLAY_NAME_MAX } from "@/lib/profile-schemas";
import { HandleForm } from "../handle-form";

// #36: onboarding in two steps — the name, then the address derived from it.
//
// One page with both fields had two problems. The address could only be
// derived while the name was being typed, which meant deciding on every
// keystroke whether to overwrite what the visitor had put in the address; and
// nothing stopped a submit with the name still empty, which failed at the API
// with a message that said only "saving failed".
//
// Two steps remove both. Step one cannot be left without a name, so the second
// step always has something to derive from. And the derivation happens ONCE,
// on first arrival — going back to correct the name and returning leaves the
// address exactly as it was, because by then it is a decision the visitor has
// seen and may have edited. A name fixing a typo must not silently rewrite it.

export function OnboardingSteps({
  origin,
  fallbackHandle,
}: {
  origin: string;
  /** The server's proposal, for a name that yields no usable base at all. */
  fallbackHandle: string;
}) {
  const t = useTranslations("Onboarding");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState<string | null>(null);

  const trimmed = displayName.trim();

  if (handle === null) {
    return (
      <form
        className="mt-6 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed === "") return;
          setHandle(handleBaseFrom(trimmed) ?? fallbackHandle);
        }}
      >
        <label
          htmlFor="display-name"
          className="text-sm font-medium text-gray-700"
        >
          {t("nameLabel")}
        </label>
        <input
          id="display-name"
          name="displayName"
          type="text"
          autoComplete="name"
          autoFocus
          maxLength={DISPLAY_NAME_MAX}
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-describedby="display-name-hint"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
        />
        <p id="display-name-hint" className="text-sm text-gray-500">
          {t("nameHint")}
        </p>
        <button
          type="submit"
          disabled={trimmed === ""}
          className="mt-2 self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
        >
          {t("next")}
        </button>
      </form>
    );
  }

  return (
    <HandleForm
      mode="onboarding"
      origin={origin}
      initialValue={handle}
      currentHandle={null}
      nextChangeAt={null}
      displayName={trimmed}
      // Deliberately does NOT clear the handle: returning re-enters this
      // component with the address already decided.
      onBack={() => setHandle(null)}
    />
  );
}
