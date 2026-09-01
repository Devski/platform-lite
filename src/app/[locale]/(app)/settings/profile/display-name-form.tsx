"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { postJson } from "@/lib/api-client";
import { DISPLAY_NAME_MAX, displayNameSchema } from "@/lib/profile-schemas";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("Settings.profile.name");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(t("errors.invalid", { max: DISPLAY_NAME_MAX }));
      return;
    }

    setSaving(true);
    try {
      const response = await postJson("/api/profile", {
        displayName: parsed.data,
      });
      if (!response.ok) {
        setError(
          t(response.status === 429 ? "errors.rateLimited" : "errors.generic"),
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 flex flex-col gap-3"
    >
      <label
        htmlFor="display-name"
        className="text-sm font-medium text-gray-700"
      >
        {t("label")}
      </label>
      <input
        id="display-name"
        name="displayName"
        type="text"
        maxLength={DISPLAY_NAME_MAX}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "display-name-error" : undefined}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
      />
      {error && (
        <p id="display-name-error" className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-700" role="status">
          {t("saved")}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-gray-400"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </form>
  );
}
