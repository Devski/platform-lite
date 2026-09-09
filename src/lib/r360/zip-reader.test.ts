import { describe, expect, it } from "vitest";
import { buildZip, rangeFetch } from "./test-zip";
import {
  fileSource,
  MAX_DIRECTORY_BYTES,
  MAX_ENTRY_BYTES,
  openZip,
  urlSource,
  ZipError,
  type ByteSource,
  type ZipEntry,
} from "./zip-reader";
import { deflateRawSync } from "node:zlib";

// #101: the archive is never unpacked — its table of contents comes from
// the tail, each frame from its own byte range, through a local File or a
// URL that honours Range. The archives here are built by test-zip.ts.

const text = (s: string) => new TextEncoder().encode(s);
const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const frame = (n: number) => text(`frame ${n} `.repeat(200));

const local = (bytes: Uint8Array) => fileSource(new Blob([bytes.slice()]));
const remote = (bytes: Uint8Array) =>
  urlSource("https://bucket.test/orbit.zip", rangeFetch(bytes).fetch);
const bothSources = (bytes: Uint8Array): [string, () => ByteSource][] => [
  ["a local file", () => local(bytes)],
  ["a URL", () => remote(bytes)],
];

async function readAll(source: ByteSource) {
  const archive = await openZip(source);
  const out: Record<string, string> = {};
  for (const entry of archive.entries) {
    if (!entry.isDirectory)
      out[entry.name] = decode(await archive.readEntry(entry));
  }
  return { archive, out };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ZipError) return error.reason;
    throw error;
  }
  throw new Error("expected a ZipError");
}

describe("openZip", () => {
  const plain = buildZip([
    { name: "orbit/", method: 0 },
    { name: "orbit/frame_001.png", data: frame(1) },
    { name: "orbit/frame_002.png", data: frame(2), method: 8 },
    { name: "orbit/notes.txt", data: text("hello"), method: 8 },
  ]);

  describe.each(bothSources(plain))("through %s", (_label, source) => {
    it("lists the entries with their sizes, methods and offsets", async () => {
      const archive = await openZip(source());
      expect(archive.entries.map((e) => e.name)).toEqual([
        "orbit/",
        "orbit/frame_001.png",
        "orbit/frame_002.png",
        "orbit/notes.txt",
      ]);
      const [dir, stored, deflated] = archive.entries;
      expect(dir.isDirectory).toBe(true);
      expect(stored.method).toBe(0);
      expect(stored.uncompressedSize).toBe(frame(1).length);
      expect(stored.compressedSize).toBe(frame(1).length);
      expect(deflated.method).toBe(8);
      expect(deflated.uncompressedSize).toBe(frame(2).length);
      expect(deflated.compressedSize).toBeLessThan(frame(2).length);
      expect(deflated.localHeaderOffset).toBeGreaterThan(
        stored.localHeaderOffset,
      );
    });

    it("reads a stored entry as it is and inflates a deflated one", async () => {
      const { out } = await readAll(source());
      expect(out["orbit/frame_001.png"]).toBe(decode(frame(1)));
      expect(out["orbit/frame_002.png"]).toBe(decode(frame(2)));
      expect(out["orbit/notes.txt"]).toBe("hello");
    });
  });

  it("finds the end record behind an archive comment", async () => {
    const bytes = buildZip([{ name: "a.png", data: text("A") }], {
      comment: "rendered 09.09.2026 — PK\x05\x06 inside the comment too",
    });
    const { out } = await readAll(local(bytes));
    expect(out).toEqual({ "a.png": "A" });
  });

  it("reads a ZIP64 archive: the locator, the end record, the extra fields", async () => {
    const bytes = buildZip(
      [
        { name: "f1.png", data: frame(1) },
        { name: "f2.png", data: frame(2), method: 8 },
      ],
      { zip64: true },
    );
    for (const [, source] of bothSources(bytes)) {
      const { archive, out } = await readAll(source());
      expect(archive.entries.map((e) => e.name)).toEqual(["f1.png", "f2.png"]);
      expect(archive.entries[1].localHeaderOffset).toBeGreaterThan(0);
      expect(out["f2.png"]).toBe(decode(frame(2)));
    }
  });

  it("reads a ZIP64 entry that marks only its offset, behind a foreign extra field", async () => {
    const bytes = buildZip(
      [
        { name: "f1.png", data: frame(1), foreignExtra: true },
        { name: "f2.png", data: frame(2), method: 8, foreignExtra: true },
      ],
      { zip64: "offset-only" },
    );
    const { archive, out } = await readAll(local(bytes));
    expect(archive.entries[1].localHeaderOffset).toBeGreaterThan(0);
    expect(archive.entries[1].uncompressedSize).toBe(frame(2).length);
    expect(out["f2.png"]).toBe(decode(frame(2)));
  });

  it("calls a ZIP64 marker without its field corrupt, and a truncated extra field too", async () => {
    const marked = buildZip([{ name: "a.png", data: text("A") }], {
      zip64: "offset-only",
    });
    // The one ZIP64 field in the directory: id 0x0001, length 8.
    const fieldAt = marked.findIndex(
      (_, i) =>
        marked[i] === 0x01 &&
        marked[i + 1] === 0x00 &&
        marked[i + 2] === 0x08 &&
        marked[i + 3] === 0x00,
    );
    expect(fieldAt).toBeGreaterThan(0);
    // The marker stays, but the field says it carries nothing.
    const empty = marked.slice();
    empty.set([0x00, 0x00], fieldAt + 2);
    expect(await refusal(openZip(local(empty)))).toBe("corrupt");
    // The field claims more bytes than the extra area holds.
    const overlong = marked.slice();
    overlong.set([0xff, 0x00], fieldAt + 2);
    expect(await refusal(openZip(local(overlong)))).toBe("corrupt");
    // No ZIP64 field at all behind the marker.
    const foreign = marked.slice();
    foreign.set([0x55, 0x54], fieldAt);
    expect(await refusal(openZip(local(foreign)))).toBe("corrupt");
  });

  it("takes the sizes from the directory when the local header defers to a data descriptor", async () => {
    const bytes = buildZip([
      { name: "f1.png", data: frame(1), method: 8, flags: 0x0008 },
      { name: "f2.png", data: frame(2), flags: 0x0008 },
    ]);
    const { out } = await readAll(local(bytes));
    expect(out["f1.png"]).toBe(decode(frame(1)));
    expect(out["f2.png"]).toBe(decode(frame(2)));
  });

  it("tops the read up when the local header's extra field is longer than the directory's", async () => {
    const bytes = buildZip([
      { name: "f1.png", data: frame(1), localExtraPadding: 40 },
      { name: "f2.png", data: frame(2), method: 8, localExtraPadding: 40 },
    ]);
    const remote = rangeFetch(bytes);
    const archive = await openZip(
      urlSource("https://bucket.test/orbit.zip", remote.fetch),
    );
    const before = remote.calls.length;
    expect(decode(await archive.readEntry(archive.entries[0]))).toBe(
      decode(frame(1)),
    );
    expect(decode(await archive.readEntry(archive.entries[1]))).toBe(
      decode(frame(2)),
    );
    // Two reads per entry here; one when the lengths agree.
    expect(remote.calls.length - before).toBe(4);
  });

  it("tops the read up when the first read ends inside the local header itself", async () => {
    const bytes = buildZip([
      { name: "f1.png", data: text("abc"), localExtraPadding: 100 },
    ]);
    const remote = rangeFetch(bytes);
    const archive = await openZip(
      urlSource("https://bucket.test/orbit.zip", remote.fetch),
    );
    expect(decode(await archive.readEntry(archive.entries[0]))).toBe("abc");
  });

  it("reads a frame in one request when the local header agrees with the directory", async () => {
    const remote = rangeFetch(plain);
    const archive = await openZip(
      urlSource("https://bucket.test/orbit.zip", remote.fetch),
    );
    const before = remote.calls.length;
    await archive.readEntry(archive.entries[2]);
    expect(remote.calls.length - before).toBe(1);
  });

  it("refuses what is not a zip, a split archive and an encrypted one", async () => {
    const junk = new Uint8Array(4000).fill(0x41);
    expect(await refusal(openZip(fileSource(new Blob([junk]))))).toBe(
      "not_a_zip",
    );
    expect(await refusal(openZip(fileSource(new Blob([text("PK")]))))).toBe(
      "not_a_zip",
    );
    const split = buildZip([{ name: "a.png", data: text("A") }], { disk: 1 });
    expect(await refusal(openZip(local(split)))).toBe("multi_part");
    const encrypted = buildZip([
      { name: "a.png", data: text("A"), flags: 0x0001 },
    ]);
    expect(await refusal(openZip(local(encrypted)))).toBe("encrypted");
  });

  it("refuses an entry compressed with a method the platform cannot inflate", async () => {
    const bytes = buildZip([{ name: "a.png", data: text("A"), method: 12 }]);
    const archive = await openZip(local(bytes));
    expect(await refusal(archive.readEntry(archive.entries[0]))).toBe(
      "unsupported_method",
    );
  });

  it("calls a mangled entry corrupt: a wrong local signature, a bad deflate stream, a short read", async () => {
    const bytes = buildZip([
      { name: "a.png", data: frame(1), method: 8 },
      { name: "b.png", data: frame(2) },
    ]);
    const archive = await openZip(local(bytes));
    const [deflated, stored] = archive.entries;

    const badSignature = bytes.slice();
    badSignature[stored.localHeaderOffset] = 0;
    const brokenHeader = await openZip(fileSource(new Blob([badSignature])));
    expect(await refusal(brokenHeader.readEntry(brokenHeader.entries[1]))).toBe(
      "corrupt",
    );

    const badStream = bytes.slice();
    const dataStart = deflated.localHeaderOffset + 30 + deflated.nameLength;
    badStream.fill(0xff, dataStart, dataStart + deflated.compressedSize);
    const brokenStream = await openZip(fileSource(new Blob([badStream])));
    expect(await refusal(brokenStream.readEntry(brokenStream.entries[0]))).toBe(
      "corrupt",
    );

    const truncated: ZipEntry = { ...stored, compressedSize: 1 << 20 };
    expect(await refusal(archive.readEntry(truncated))).toBe("corrupt");
  });

  it("refuses to allocate what the archive merely claims", async () => {
    const bytes = buildZip([
      { name: "a.png", data: text("A") },
      { name: "b.png", data: frame(2), method: 8 },
    ]);
    const archive = await openZip(local(bytes));
    const [stored, deflated] = archive.entries;
    const claims = new Map<string, ZipEntry>([
      ["a stored entry past the archive", { ...stored, compressedSize: 4000 }],
      [
        "a stored entry past the ceiling",
        { ...stored, compressedSize: MAX_ENTRY_BYTES + 1 },
      ],
      [
        "an inflated size past the ceiling",
        { ...deflated, uncompressedSize: MAX_ENTRY_BYTES + 1 },
      ],
      [
        "an offset past the end",
        { ...stored, localHeaderOffset: bytes.length + 10 },
      ],
      [
        "a stored entry whose sizes disagree",
        { ...stored, uncompressedSize: 2 },
      ],
      [
        "a deflate stream that inflates past its promise",
        { ...deflated, uncompressedSize: 10 },
      ],
      [
        "a deflate stream that stops short of its promise",
        { ...deflated, uncompressedSize: frame(2).length + 1 },
      ],
    ]);
    for (const [label, entry] of claims) {
      expect(await refusal(archive.readEntry(entry)), label).toBe("corrupt");
    }
    // The bomb: 64 KiB of zeros inflate from a few dozen bytes; the reader
    // stops at the promised size instead of finishing the stream.
    const zeros = new Uint8Array(65536);
    const bomb = buildZip([{ name: "z.png", data: zeros, method: 8 }]);
    const bombed = await openZip(local(bomb));
    expect(new Uint8Array(deflateRawSync(zeros)).length).toBeLessThan(200);
    expect(
      await refusal(
        bombed.readEntry({ ...bombed.entries[0], uncompressedSize: 100 }),
      ),
    ).toBe("corrupt");
    expect((await bombed.readEntry(bombed.entries[0])).length).toBe(65536);
  });

  it("refuses a central directory past the ceiling before reading it", async () => {
    const source: ByteSource = {
      size: async () => MAX_DIRECTORY_BYTES + 1000,
      async readRange(offset, length) {
        // A tail whose end record points at a directory of the whole file.
        const tail = buildZip([]);
        const view = new DataView(tail.buffer);
        view.setUint16(10, 1, true);
        view.setUint32(12, MAX_DIRECTORY_BYTES + 1, true);
        view.setUint32(16, 0, true);
        const out = new Uint8Array(length);
        out.set(tail, length - tail.length);
        void offset;
        return out;
      },
    };
    expect(await refusal(openZip(source))).toBe("corrupt");
  });

  it("calls a directory that points past the end corrupt", async () => {
    const bytes = buildZip([{ name: "a.png", data: text("A") }]);
    const view = new DataView(bytes.buffer);
    view.setUint32(bytes.length - 22 + 16, 0x7fffffff, true);
    expect(await refusal(openZip(fileSource(new Blob([bytes]))))).toBe(
      "corrupt",
    );
  });
});

describe("urlSource", () => {
  const bytes = buildZip([{ name: "a.png", data: text("A") }]);

  it("learns the size from Content-Range and asks for exact ranges", async () => {
    const remote = rangeFetch(bytes);
    const source = urlSource("https://bucket.test/orbit.zip", remote.fetch);
    expect(await source.size()).toBe(bytes.length);
    expect(await source.size()).toBe(bytes.length);
    expect(remote.calls).toEqual(["bytes=0-0"]);
    expect(await source.readRange(4, 3)).toEqual(bytes.slice(4, 7));
    expect(remote.calls[1]).toBe("bytes=4-6");
    expect(await source.readRange(0, 0)).toEqual(new Uint8Array(0));
    expect(remote.calls.length).toBe(2);
  });

  it("refuses a server that ignores Range rather than download the whole archive", async () => {
    const whole = async () => new Response(bytes.slice(), { status: 200 });
    const source = urlSource("https://bucket.test/orbit.zip", whole);
    expect(await refusal(source.size())).toBe("range_unsupported");
    expect(await refusal(source.readRange(0, 4))).toBe("range_unsupported");
  });

  it("names any other status, a missing Content-Range, and retries the size after a failure", async () => {
    let status = 403;
    const failing = async () => new Response(null, { status });
    const source = urlSource("https://bucket.test/orbit.zip", failing);
    expect(await refusal(source.size())).toBe("http");
    status = 206;
    // 206 without Content-Range: the size is unknowable.
    expect(await refusal(source.size())).toBe("http");
    const working = urlSource(
      "https://bucket.test/orbit.zip",
      rangeFetch(bytes).fetch,
    );
    expect(await working.size()).toBe(bytes.length);
  });

  it("calls 416 corrupt, a failed request network, and sends nothing of the page", async () => {
    const remote = rangeFetch(bytes);
    const source = urlSource("https://bucket.test/orbit.zip", remote.fetch);
    expect(await refusal(source.readRange(bytes.length + 5, 4))).toBe(
      "corrupt",
    );
    let init: RequestInit | undefined;
    const failing: typeof fetch = async (_input, options) => {
      init = options;
      throw new TypeError("Failed to fetch");
    };
    const offline = urlSource("https://bucket.test/orbit.zip", failing);
    expect(await refusal(offline.size())).toBe("network");
    expect(init).toMatchObject({
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
    });
    const total = "9".repeat(20);
    const huge = async () =>
      new Response(new Uint8Array(1), {
        status: 206,
        headers: { "Content-Range": `bytes 0-0/${total}` },
      });
    expect(
      await refusal(urlSource("https://bucket.test/orbit.zip", huge).size()),
    ).toBe("http");
  });

  it("calls a short answer corrupt", async () => {
    const short = async () =>
      new Response(new Uint8Array(2), {
        status: 206,
        headers: { "Content-Range": "bytes 0-1/100" },
      });
    const source = urlSource("https://bucket.test/orbit.zip", short);
    expect(await refusal(source.readRange(0, 4))).toBe("corrupt");
  });
});

describe("fileSource", () => {
  it("reads by slice and calls a read past the end corrupt", async () => {
    const source = fileSource(new Blob([text("abcdef")]));
    expect(await source.size()).toBe(6);
    expect(decode(await source.readRange(2, 3))).toBe("cde");
    expect(await refusal(source.readRange(4, 10))).toBe("corrupt");
  });
});
