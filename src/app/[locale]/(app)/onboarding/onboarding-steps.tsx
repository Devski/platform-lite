"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Plaque } from "@/components/ui/plaque";
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

  return (
    // Card and plaque are each a fixed size, not flexed to fill the page —
    // a fixed 64px gap, and the pair centered as one unit, the same way the
    // auth cards (screen 4) center on their own.
    <div className="flex w-full flex-col items-center gap-(--sp-8) md:w-auto md:flex-row md:gap-(--sp-12)">
      <Card padding="lg" className="w-full md:w-[420px]">
        <Badge uppercase>{t("stepBadge", { step: handle === null ? 1 : 2 })}</Badge>
        {handle === null ? (
          <>
            <h1 className="mt-(--sp-5) type-h1 text-(--text-strong)">
              {t("nameStepHeading")}
            </h1>
            <form
              className="mt-(--sp-7) flex flex-col gap-(--sp-5)"
              onSubmit={(event) => {
                event.preventDefault();
                if (trimmed === "") return;
                setHandle(handleBaseFrom(trimmed) ?? fallbackHandle);
              }}
            >
              <FormField
                label={t("nameLabel")}
                htmlFor="display-name"
                hint={t("nameHint")}
                hintId="display-name-hint"
              >
                <Input
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
                />
              </FormField>
              <Button type="submit" size="lg" disabled={trimmed === ""} className="self-start">
                {t("next")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-(--sp-5) type-h1 text-(--text-strong)">
              {t("heading")}
            </h1>
            <p className="mt-(--sp-3) type-sm text-(--text-muted)">
              {t("intro")}
            </p>
            <div className="mt-(--sp-7)">
              <HandleForm
                mode="onboarding"
                origin={origin}
                initialValue={handle}
                currentHandle={null}
                nextChangeAt={null}
                displayName={trimmed}
                // Deliberately does NOT clear the handle: returning
                // re-enters this component with the address already decided.
                onBack={() => setHandle(null)}
              />
            </div>
          </>
        )}
      </Card>
      <div className="flex flex-col items-center gap-(--sp-5)">
        <Plaque name={trimmed || undefined} width={260} tilt={0} />
        <p className="type-sm max-w-[16rem] text-center text-(--text-subtle)">
          {t("plaqueCaption")}
        </p>
      </div>
    </div>
  );
}
