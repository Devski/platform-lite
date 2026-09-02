import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { users } from "@/db/schema";
import { createTestDb, type TestDb } from "@/db/test-db";
import { routing, type Locale } from "@/i18n/routing";
import { confirmAvatarUpload, presignAvatarUpload } from "./avatar";
import { getProfile, setAvatar, updateDisplayName } from "./profile";
import { setHandle } from "./profile-handle";
import {
  loadPublicProfile,
  profileMetadata,
  type PublicProfile,
  type PublicProfileDeps,
} from "./public-profile";
import { createMemoryStorage, type FileStorage } from "./storage";

// Integration suite for #18 on the memory fake + PGlite: the public read of
// a profile composed from the real layers (a handle via setHandle, a name via
// updateDisplayName, an avatar through the #12 pipeline), and the <head> the
// page derives from it. Everything but getProfile is the real module — that
// one is a pass-through spy so the read-after-delete race can be provoked.

vi.mock("./profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./profile")>();
  return { ...actual, getProfile: vi.fn(actual.getProfile) };
});

const PREFIX = "devski/";
const T0 = new Date("2026-09-02T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const ORIGIN = "https://app.example";
const BRAND = "platform-lite";
const PLACEHOLDER = `${ORIGIN}/og-placeholder.png`;
// The A8 prefix rule by hand (`localePrefix: "as-needed"`): the page passes
// next-intl's getPathname, which needs a request config this suite has not.
const pathFor = (handle: string, locale: Locale) =>
  locale === routing.defaultLocale ? `/${handle}` : `/${locale}/${handle}`;

let testDb: TestDb;
let userId: string;
// The read deps under test; the write side of the fixtures shares the same
// memory storage, so the URLs the read resolves name objects that exist.
let storage: FileStorage;
let deps: PublicProfileDeps;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  vi.mocked(getProfile).mockClear();
  // users.name mirrors sign-up: seeded from the e-mail local part (#7).
  const [row] = await testDb.db
    .insert(users)
    .values({ name: "owner-local", email: "owner-local@example.com" })
    .returning({ id: users.id });
  userId = row.id;
  storage = createMemoryStorage().storage;
  deps = { db: testDb.db, storage, prefix: PREFIX };
});

/** The #12 pipeline end to end, as profile.test.ts drives it. */
async function uploadAndSetAvatar(): Promise<{ sha256: string }> {
  const image = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 30, g: 120, b: 80 },
    },
  })
    .png()
    .toBuffer();
  const writeDeps = { db: testDb.db, storage, prefix: PREFIX, userId };
  const { stagingKey } = await presignAvatarUpload(writeDeps, {
    sizeBytes: image.length,
    contentType: "image/png",
  });
  await storage.putObject(stagingKey, image, "image/png");
  const confirmed = await confirmAvatarUpload(writeDeps, { stagingKey });
  await setAvatar(writeDeps, confirmed.original.fileId);
  return { sha256: confirmed.original.sha256 };
}

describe("loadPublicProfile (§9 for the public page)", () => {
  it("resolves a live handle to the name and the two avatar variant URLs", async () => {
    await setHandle(testDb.db, userId, "studio-x", T0);
    await updateDisplayName({ db: testDb.db, userId }, "Studio X");
    const { sha256 } = await uploadAndSetAvatar();

    // toEqual, not toMatchObject: the public object must carry nothing
    // internal (no file id) — it is what an anonymous visitor's page sees.
    expect(await loadPublicProfile(deps, "studio-x")).toEqual({
      kind: "profile",
      canonical: true,
      profile: {
        userId,
        handle: "studio-x",
        displayName: "Studio X",
        avatar: {
          url512: `memory://${PREFIX}a/${sha256}-512.webp`,
          url128: `memory://${PREFIX}a/${sha256}-128.webp`,
        },
      },
    });
  });

  it("answers avatar: null and the seeded display name for a profile without one", async () => {
    // setHandle seeds display_name from users.name, so a live handle always
    // has a name to show — no users.name fallback on the read side.
    await setHandle(testDb.db, userId, "studio-x", T0);
    expect(await loadPublicProfile(deps, "studio-x")).toEqual({
      kind: "profile",
      canonical: true,
      profile: {
        userId,
        handle: "studio-x",
        displayName: "owner-local",
        avatar: null,
      },
    });
  });

  it("finds the profile under a case/whitespace variant but marks it non-canonical", async () => {
    await setHandle(testDb.db, userId, "studio-x", T0);
    const lookup = await loadPublicProfile(deps, " Studio-X ");
    expect(lookup).toMatchObject({
      kind: "profile",
      canonical: false,
      profile: { handle: "studio-x" },
    });
  });

  it("answers redirect to the current handle for an old address", async () => {
    await setHandle(testDb.db, userId, "old-name", T0);
    await setHandle(testDb.db, userId, "new-name", new Date(T0.getTime() + DAY_MS));
    expect(await loadPublicProfile(deps, "old-name")).toEqual({
      kind: "redirect",
      handle: "new-name",
    });
    expect(await loadPublicProfile(deps, "Old-Name")).toEqual({
      kind: "redirect",
      handle: "new-name",
    });
    expect(vi.mocked(getProfile)).not.toHaveBeenCalled();
  });

  it("answers notFound for an unknown handle, a reserved word and invalid input", async () => {
    await setHandle(testDb.db, userId, "studio-x", T0);
    for (const input of ["nobody-here", "admin", "-x-", ""]) {
      expect(await loadPublicProfile(deps, input)).toEqual({
        kind: "notFound",
      });
    }
    expect(vi.mocked(getProfile)).not.toHaveBeenCalled();
  });

  it("answers notFound when the row vanished between the two reads", async () => {
    // display_name is NOT NULL, so getProfile's null name means the row is
    // gone — the account was deleted (cascade) after the handle resolved.
    // That is a profile that no longer exists, not an outage: 404, not 500.
    await setHandle(testDb.db, userId, "studio-x", T0);
    vi.mocked(getProfile).mockResolvedValueOnce({
      displayName: null,
      avatar: null,
    });
    expect(await loadPublicProfile(deps, "studio-x")).toEqual({
      kind: "notFound",
    });
  });
});

describe("profileMetadata", () => {
  const withAvatar: PublicProfile = {
    userId: "00000000-0000-4000-8000-000000000001",
    handle: "studio-x",
    displayName: "Studio X",
    avatar: {
      url512: "https://cdn.example/a/abc-512.webp",
      url128: "https://cdn.example/a/abc-128.webp",
    },
  };
  const withoutAvatar: PublicProfile = { ...withAvatar, avatar: null };

  function metadataFor(profile: PublicProfile, locale: Locale) {
    return profileMetadata({
      profile,
      origin: ORIGIN,
      locale,
      brand: BRAND,
      description: `Profil ${profile.displayName} na ${BRAND}`,
      placeholderImage: PLACEHOLDER,
      pathFor,
    });
  }

  it("Polish: title, description, unprefixed canonical, hreflang map, OG and Twitter", () => {
    const meta = metadataFor(withAvatar, "pl");
    expect(meta.title).toBe("Studio X · platform-lite");
    expect(meta.description).toBe("Profil Studio X na platform-lite");
    expect(meta.alternates).toEqual({
      canonical: "https://app.example/studio-x",
      languages: {
        pl: "https://app.example/studio-x",
        en: "https://app.example/en/studio-x",
      },
    });
    expect(meta.openGraph).toMatchObject({
      type: "profile",
      title: "Studio X · platform-lite",
      description: "Profil Studio X na platform-lite",
      url: "https://app.example/studio-x",
      locale: "pl_PL",
      images: [
        { url: "https://cdn.example/a/abc-512.webp", width: 512, height: 512 },
      ],
    });
    expect(meta.twitter).toEqual({ card: "summary" });
  });

  it("English: canonical under /en, OG locale en_US, the same hreflang map", () => {
    const meta = metadataFor(withAvatar, "en");
    expect(meta.alternates?.canonical).toBe("https://app.example/en/studio-x");
    expect(meta.alternates?.languages).toEqual({
      pl: "https://app.example/studio-x",
      en: "https://app.example/en/studio-x",
    });
    expect(meta.openGraph).toMatchObject({
      url: "https://app.example/en/studio-x",
      locale: "en_US",
    });
  });

  it("lists every routing locale in the hreflang map", () => {
    const meta = metadataFor(withAvatar, "pl");
    expect(Object.keys(meta.alternates?.languages ?? {}).sort()).toEqual(
      [...routing.locales].sort(),
    );
  });

  it("falls back to the 1200×630 placeholder as the OG image without an avatar", () => {
    const meta = metadataFor(withoutAvatar, "pl");
    expect(meta.openGraph).toMatchObject({
      images: [{ url: PLACEHOLDER, width: 1200, height: 630 }],
    });
  });
});
