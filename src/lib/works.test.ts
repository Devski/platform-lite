import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { files, workImages, works } from "@/db/schema";
import { insertTestAccount } from "@/db/test-account";
import { createTestDb, type TestDb } from "@/db/test-db";
import { confirmImageUpload, presignImageUpload } from "./image-upload";
import { updateDisplayName } from "./profile";
import { createMemoryStorage } from "./storage";
import { WORKS_MAX } from "./work-schemas";
import {
  createWork,
  deleteWork,
  discardWorkImage,
  listWorks,
  updateWork,
} from "./works";

// #72 / A12: works on PGlite + the memory storage fake, photos through the
// real pipeline — the limit, the ownership of every photo, the main photo
// as position 0, and what deleting frees (and what it must not).

const PREFIX = "devski/";

let testDb: TestDb;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  userId = await insertTestAccount(testDb.db, { email: "works@example.com" });
  otherUserId = await insertTestAccount(testDb.db, {
    email: "other-works@example.com",
  });
  await updateDisplayName({ db: testDb.db, userId }, "Pracownia Testowa");
  await updateDisplayName(
    { db: testDb.db, userId: otherUserId },
    "Inna Pracownia",
  );
});

function makeDeps(ownerId = userId) {
  const memory = createMemoryStorage();
  return {
    objects: memory.objects,
    deps: {
      db: testDb.db,
      storage: memory.storage,
      prefix: PREFIX,
      userId: ownerId,
    },
  };
}

async function uploadPhoto(
  d: ReturnType<typeof makeDeps>,
  seed: number,
  purpose: "work" | "cover" = "work",
) {
  const image = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: seed % 255, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
  const { stagingKey } = await presignImageUpload(d.deps, {
    sizeBytes: image.length,
    contentType: "image/png",
  });
  await d.deps.storage.putObject(stagingKey, image, "image/png");
  return confirmImageUpload(d.deps, { stagingKey, purpose });
}

describe("createWork + listWorks", () => {
  it("stores the fields, keeps the photos in the given order with the first as main, and lists in adding order", async () => {
    const d = makeDeps();
    const [a, b, c] = await Promise.all([
      uploadPhoto(d, 1),
      uploadPhoto(d, 2),
      uploadPhoto(d, 3),
    ]);
    const first = await createWork(d.deps, {
      name: "  Osiedle Nowe Żerniki  ",
      investor: "Archicom",
      developer: "",
      imageFileIds: [b.original.fileId, a.original.fileId, c.original.fileId],
    });
    await createWork(d.deps, {
      name: "Kamienica",
      imageFileIds: [a.original.fileId],
    });

    const list = await listWorks(d.deps);
    expect(list.map((work) => work.name)).toEqual([
      "Osiedle Nowe Żerniki",
      "Kamienica",
    ]);
    expect(list[0]).toMatchObject({
      id: first.id,
      investor: "Archicom",
      developer: null,
      hasR360: false,
    });
    expect(list[0].images.map((image) => image.fileId)).toEqual([
      b.original.fileId,
      a.original.fileId,
      c.original.fileId,
    ]);
    expect(list[0].images[0].url1600).toBe(
      `memory://${PREFIX}u/${userId}/${b.original.sha256}-1600.webp`,
    );
    expect(list[0].images[0].url480).toBe(
      `memory://${PREFIX}u/${userId}/${b.original.sha256}-480.webp`,
    );
    // Positions are 0..n-1 in the order given.
    const positions = await testDb.db
      .select()
      .from(workImages)
      .where(eq(workImages.workId, first.id));
    expect(positions.map((row) => [row.position, row.fileId]).sort()).toEqual(
      [
        [0, b.original.fileId],
        [1, a.original.fileId],
        [2, c.original.fileId],
      ].sort(),
    );
  });

  it("refuses the eleventh work, another user's photo, a cover as a photo, and bad fields", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d, 4);
    for (let i = 0; i < WORKS_MAX; i++) {
      await createWork(d.deps, {
        name: `Praca ${i}`,
        imageFileIds: [photo.original.fileId],
      });
    }
    await expect(
      createWork(d.deps, {
        name: "Jedenasta",
        imageFileIds: [photo.original.fileId],
      }),
    ).rejects.toMatchObject({ code: "limit" });

    const theirs = await uploadPhoto(makeDeps(otherUserId), 5);
    const fresh = makeDeps();
    await testDb.db.delete(works);
    await expect(
      createWork(fresh.deps, {
        name: "Cudze",
        imageFileIds: [theirs.original.fileId],
      }),
    ).rejects.toMatchObject({ code: "invalid_image" });
    const cover = await uploadPhoto(fresh, 6, "cover");
    await expect(
      createWork(fresh.deps, {
        name: "Tło",
        imageFileIds: [cover.original.fileId],
      }),
    ).rejects.toMatchObject({ code: "invalid_image" });

    await expect(
      createWork(fresh.deps, {
        name: "   ",
        imageFileIds: [photo.original.fileId],
      }),
    ).rejects.toThrow();
    await expect(
      createWork(fresh.deps, { name: "Bez zdjęcia", imageFileIds: [] }),
    ).rejects.toThrow();
    await expect(
      createWork(fresh.deps, {
        name: "Powtórka",
        imageFileIds: [photo.original.fileId, photo.original.fileId],
      }),
    ).rejects.toThrow();
    expect(await listWorks(fresh.deps)).toEqual([]);
  });
});

describe("updateWork", () => {
  it("reorders the photos (a new main), drops the removed one's set, and keeps a photo another work still names", async () => {
    const d = makeDeps();
    const [a, b, c] = await Promise.all([
      uploadPhoto(d, 7),
      uploadPhoto(d, 8),
      uploadPhoto(d, 9),
    ]);
    const { id } = await createWork(d.deps, {
      name: "Praca",
      imageFileIds: [a.original.fileId, b.original.fileId, c.original.fileId],
    });
    await createWork(d.deps, {
      name: "Druga",
      imageFileIds: [c.original.fileId],
    });

    await updateWork(d.deps, id, {
      name: "Praca po zmianie",
      investor: "Inwestor",
      imageFileIds: [b.original.fileId],
    });
    // a left this work and nothing else names it: its set is freed.
    expect(d.objects.has(a.original.key)).toBe(false);
    expect(d.objects.has(a.variants[0].key)).toBe(false);
    expect(
      await testDb.db
        .select()
        .from(files)
        .where(eq(files.id, a.original.fileId)),
    ).toHaveLength(0);
    const [work] = await listWorks(d.deps);
    expect(work.name).toBe("Praca po zmianie");
    expect(work.investor).toBe("Inwestor");
    expect(work.images.map((image) => image.fileId)).toEqual([
      b.original.fileId,
    ]);
    // c left this work but the second work still names it: its set stays.
    expect(d.objects.has(c.variants[0].key)).toBe(true);
    expect(
      await testDb.db
        .select()
        .from(files)
        .where(eq(files.id, c.original.fileId)),
    ).toHaveLength(1);
  });

  it("refuses another user's work", async () => {
    const d = makeDeps();
    const photo = await uploadPhoto(d, 10);
    const { id } = await createWork(d.deps, {
      name: "Moja",
      imageFileIds: [photo.original.fileId],
    });
    const other = makeDeps(otherUserId);
    const theirs = await uploadPhoto(other, 11);
    await expect(
      updateWork(other.deps, id, {
        name: "Przejęta",
        imageFileIds: [theirs.original.fileId],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteWork(other.deps, id)).rejects.toMatchObject({
      code: "not_found",
    });
    expect((await listWorks(d.deps))[0].name).toBe("Moja");
  });
});

describe("deleteWork + discardWorkImage", () => {
  it("deleting a work frees its photos' rows and objects, except the ones another work names", async () => {
    const d = makeDeps();
    const [a, shared] = await Promise.all([
      uploadPhoto(d, 12),
      uploadPhoto(d, 13),
    ]);
    const { id } = await createWork(d.deps, {
      name: "Do usunięcia",
      imageFileIds: [a.original.fileId, shared.original.fileId],
    });
    await createWork(d.deps, {
      name: "Zostaje",
      imageFileIds: [shared.original.fileId],
    });

    await deleteWork(d.deps, id);
    expect((await listWorks(d.deps)).map((work) => work.name)).toEqual([
      "Zostaje",
    ]);
    expect(d.objects.has(a.original.key)).toBe(false);
    expect(d.objects.has(a.variants[0].key)).toBe(false);
    expect(d.objects.has(shared.variants[0].key)).toBe(true);
    const rows = await testDb.db.select().from(files);
    expect(rows.map((row) => row.kind).sort()).toEqual([
      "work-1600",
      "work-480",
      "work-original",
    ]);
    expect(await testDb.db.select().from(workImages)).toHaveLength(1);
  });

  it("discards a confirmed photo nothing names, and refuses one a work still uses", async () => {
    const d = makeDeps();
    const loose = await uploadPhoto(d, 14);
    const used = await uploadPhoto(d, 15);
    await createWork(d.deps, {
      name: "W użyciu",
      imageFileIds: [used.original.fileId],
    });

    await discardWorkImage(d.deps, loose.original.fileId);
    expect(d.objects.has(loose.original.key)).toBe(false);
    // A used photo is left alone — silently, since the form may call this
    // for any photo it uploaded.
    await discardWorkImage(d.deps, used.original.fileId);
    expect(d.objects.has(used.variants[0].key)).toBe(true);
    // Another user's, or a cover: refused.
    await expect(
      discardWorkImage(makeDeps(otherUserId).deps, used.original.fileId),
    ).rejects.toMatchObject({ code: "invalid_image" });
    const cover = await uploadPhoto(d, 16, "cover");
    await expect(
      discardWorkImage(d.deps, cover.original.fileId),
    ).rejects.toMatchObject({ code: "invalid_image" });
    expect(d.objects.has(cover.variants[0].key)).toBe(true);
  });
});
