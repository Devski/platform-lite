// #101 (step 2 of #68, A13): a zip archive read without unpacking it — in
// the owner's browser before the upload, from the bucket after it. Only
// the archive's table of contents and the frames asked for are fetched;
// nothing is decompressed but the one entry in hand, by the platform's
// own inflater. Pure TypeScript, no dependency (SPEC §7).
//
// Layout of a zip, from the end: the end-of-central-directory record (with
// an optional comment after it), before it the ZIP64 locator and record
// when the archive needs 64-bit sizes, before those the central directory
// — one record per entry with its name, sizes, method and the offset of
// its local header. Each local header sits in front of its entry's data.

export interface ByteSource {
  /** The archive's length in bytes. */
  size(): Promise<number>;
  /** The bytes [offset, offset + length) — exactly that many, or a ZipError. */
  readRange(offset: number, length: number): Promise<Uint8Array>;
}

export type ZipRefusal =
  /** No end-of-central-directory record in the tail — not a zip at all. */
  | "not_a_zip"
  /** An entry carries the encryption flag. */
  | "encrypted"
  /** The archive spans more than one disk (a split archive). */
  | "multi_part"
  /** An entry is neither stored nor deflated. */
  | "unsupported_method"
  /** A signature or a length that does not agree with the record. */
  | "corrupt"
  /** The server answered a Range request with the whole body. */
  | "range_unsupported"
  /** The server answered anything else than 206. */
  | "http";

export class ZipError extends Error {
  constructor(
    readonly reason: ZipRefusal,
    detail?: string,
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  name: string;
  /** A directory record: a name ending with a slash, no data. */
  isDirectory: boolean;
  /** The compression method: 0 stored, 8 deflate, anything else refused. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  /** Lengths from the central directory — the local header's may differ. */
  nameLength: number;
  extraLength: number;
}

export interface ZipArchive {
  entries: ZipEntry[];
  /** The entry's bytes, inflated when the entry is deflated. */
  readEntry(entry: ZipEntry): Promise<Uint8Array>;
}

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_LENGTH = 22;
const EOCD_MAX_COMMENT = 0xffff;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_LENGTH = 20;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EOCD_LENGTH = 56;
const ZIP64_EXTRA_ID = 0x0001;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_LENGTH = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_LENGTH = 30;
const FLAG_ENCRYPTED = 0x0001;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const MAX_16 = 0xffff;
const MAX_32 = 0xffffffff;

// ---------------------------------------------------------------- sources

/** A local file, read through Blob.slice — nothing leaves the machine. */
export function fileSource(file: Blob): ByteSource {
  return {
    size: async () => file.size,
    async readRange(offset, length) {
      const bytes = new Uint8Array(
        await file.slice(offset, offset + length).arrayBuffer(),
      );
      return exactly(bytes, length);
    },
  };
}

/**
 * A remote archive, read through fetch with a Range header. The size is
 * learned from the first answer's Content-Range — a HEAD would not do,
 * since a presigned URL is signed for one method. Bucket CORS must allow
 * GET with `range` and expose `Content-Range` (docs/dev-environment.md).
 */
export function urlSource(
  url: string,
  fetchImpl: typeof fetch = fetch,
): ByteSource {
  let size: Promise<number> | undefined;
  const request = async (range: string): Promise<Response> => {
    const response = await fetchImpl(url, { headers: { Range: range } });
    if (response.status === 200) throw new ZipError("range_unsupported");
    if (response.status !== 206) {
      throw new ZipError("http", String(response.status));
    }
    return response;
  };
  return {
    size() {
      size ??= request("bytes=0-0").then(
        (response) =>
          totalFromContentRange(response.headers.get("content-range")),
        (error: unknown) => {
          size = undefined;
          throw error;
        },
      );
      return size;
    },
    async readRange(offset, length) {
      if (length === 0) return new Uint8Array(0);
      const response = await request(`bytes=${offset}-${offset + length - 1}`);
      return exactly(new Uint8Array(await response.arrayBuffer()), length);
    },
  };
}

function totalFromContentRange(header: string | null): number {
  const total = /^bytes \d+-\d+\/(\d+)$/.exec(header ?? "")?.[1];
  if (!total) throw new ZipError("http", "no Content-Range");
  return Number(total);
}

function exactly(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length !== length) {
    throw new ZipError(
      "corrupt",
      `asked for ${length} bytes, received ${bytes.length}`,
    );
  }
  return bytes;
}

// ---------------------------------------------------------------- opening

/** Reads the table of contents; refuses what the viewer cannot use. */
export async function openZip(source: ByteSource): Promise<ZipArchive> {
  const size = await source.size();
  if (size < EOCD_LENGTH) throw new ZipError("not_a_zip");
  const tailLength = Math.min(size, EOCD_LENGTH + EOCD_MAX_COMMENT);
  const tailStart = size - tailLength;
  const tail = await source.readRange(tailStart, tailLength);
  const eocd = findEndRecord(tail);
  if (eocd === -1) throw new ZipError("not_a_zip");

  const view = dataView(tail);
  let entryCount: number = view.getUint16(eocd + 10, true);
  let directorySize: number = view.getUint32(eocd + 12, true);
  let directoryOffset: number = view.getUint32(eocd + 16, true);
  const diskNumber = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const needsZip64 =
    entryCount === MAX_16 ||
    directorySize === MAX_32 ||
    directoryOffset === MAX_32 ||
    diskNumber === MAX_16 ||
    directoryDisk === MAX_16;
  if (!needsZip64 && (diskNumber !== 0 || directoryDisk !== 0)) {
    throw new ZipError("multi_part");
  }
  if (needsZip64) {
    const locatorAt = tailStart + eocd - ZIP64_LOCATOR_LENGTH;
    if (locatorAt < 0) throw new ZipError("corrupt", "no ZIP64 locator");
    const locator = dataView(
      await readWithin(
        source,
        tail,
        tailStart,
        locatorAt,
        ZIP64_LOCATOR_LENGTH,
      ),
    );
    if (locator.getUint32(0, true) !== ZIP64_LOCATOR_SIGNATURE) {
      throw new ZipError("corrupt", "no ZIP64 locator");
    }
    if (locator.getUint32(16, true) > 1) throw new ZipError("multi_part");
    const recordAt = safeNumber(locator.getBigUint64(8, true));
    const record = dataView(
      await readWithin(source, tail, tailStart, recordAt, ZIP64_EOCD_LENGTH),
    );
    if (record.getUint32(0, true) !== ZIP64_EOCD_SIGNATURE) {
      throw new ZipError("corrupt", "no ZIP64 end record");
    }
    if (record.getUint32(16, true) !== 0 || record.getUint32(20, true) !== 0) {
      throw new ZipError("multi_part");
    }
    entryCount = safeNumber(record.getBigUint64(32, true));
    directorySize = safeNumber(record.getBigUint64(40, true));
    directoryOffset = safeNumber(record.getBigUint64(48, true));
  }
  if (directoryOffset + directorySize > size) {
    throw new ZipError("corrupt", "central directory past the end");
  }

  const directory = await readWithin(
    source,
    tail,
    tailStart,
    directoryOffset,
    directorySize,
  );
  const entries = parseCentralDirectory(directory, entryCount);
  return { entries, readEntry: (entry) => readEntry(source, entry) };
}

/** The end record's offset inside the tail: the last signature wins. */
function findEndRecord(tail: Uint8Array): number {
  const view = dataView(tail);
  for (let at = tail.length - EOCD_LENGTH; at >= 0; at--) {
    if (view.getUint32(at, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(at + 20, true);
    if (at + EOCD_LENGTH + commentLength === tail.length) return at;
  }
  return -1;
}

/** Bytes served from the tail already in hand, or read from the source. */
async function readWithin(
  source: ByteSource,
  tail: Uint8Array,
  tailStart: number,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  if (offset >= tailStart && offset + length <= tailStart + tail.length) {
    return tail.subarray(offset - tailStart, offset - tailStart + length);
  }
  return source.readRange(offset, length);
}

function parseCentralDirectory(
  directory: Uint8Array,
  entryCount: number,
): ZipEntry[] {
  const view = dataView(directory);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let at = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      at + CENTRAL_LENGTH > directory.length ||
      view.getUint32(at, true) !== CENTRAL_SIGNATURE
    ) {
      throw new ZipError("corrupt", `central directory entry ${index}`);
    }
    const flags = view.getUint16(at + 8, true);
    if (flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION)) {
      throw new ZipError("encrypted");
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const nameStart = at + CENTRAL_LENGTH;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;
    if (next > directory.length) {
      throw new ZipError("corrupt", `central directory entry ${index}`);
    }
    const name = decoder.decode(directory.subarray(nameStart, extraStart));
    const fields = zip64Fields(
      directory.subarray(extraStart, extraStart + extraLength),
      {
        uncompressedSize: view.getUint32(at + 24, true),
        compressedSize: view.getUint32(at + 20, true),
        localHeaderOffset: view.getUint32(at + 42, true),
        disk: view.getUint16(at + 34, true),
      },
    );
    if (fields.disk !== 0) throw new ZipError("multi_part");
    entries.push({
      name,
      isDirectory: name.endsWith("/"),
      method: view.getUint16(at + 10, true),
      compressedSize: fields.compressedSize,
      uncompressedSize: fields.uncompressedSize,
      localHeaderOffset: fields.localHeaderOffset,
      nameLength,
      extraLength,
    });
    at = next;
  }
  return entries;
}

interface EntryFields {
  uncompressedSize: number;
  compressedSize: number;
  localHeaderOffset: number;
  disk: number;
}

/**
 * The ZIP64 extra field carries the 64-bit value of every field the record
 * itself could only mark as "too big" — in this fixed order, present only
 * for the fields marked.
 */
function zip64Fields(extra: Uint8Array, fields: EntryFields): EntryFields {
  const view = dataView(extra);
  let at = 0;
  while (at + 4 <= extra.length) {
    const id = view.getUint16(at, true);
    const length = view.getUint16(at + 2, true);
    const start = at + 4;
    at = start + length;
    if (id !== ZIP64_EXTRA_ID || at > extra.length) continue;
    const resolved = { ...fields };
    let cursor = start;
    const take64 = () => {
      if (cursor + 8 > at) throw new ZipError("corrupt", "ZIP64 extra field");
      const value = safeNumber(view.getBigUint64(cursor, true));
      cursor += 8;
      return value;
    };
    if (fields.uncompressedSize === MAX_32) {
      resolved.uncompressedSize = take64();
    }
    if (fields.compressedSize === MAX_32) resolved.compressedSize = take64();
    if (fields.localHeaderOffset === MAX_32) {
      resolved.localHeaderOffset = take64();
    }
    if (fields.disk === MAX_16) {
      if (cursor + 4 > at) throw new ZipError("corrupt", "ZIP64 extra field");
      resolved.disk = view.getUint32(cursor, true);
    }
    return resolved;
  }
  return fields;
}

// ---------------------------------------------------------------- entries

/**
 * One entry's data. The local header's name and extra lengths may differ
 * from the central directory's, so the read is sized by the directory's
 * figures and topped up when the local header says the data starts later.
 */
async function readEntry(
  source: ByteSource,
  entry: ZipEntry,
): Promise<Uint8Array> {
  if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATE) {
    throw new ZipError("unsupported_method", `${entry.name}: ${entry.method}`);
  }
  const guessedHeader = LOCAL_LENGTH + entry.nameLength + entry.extraLength;
  const first = await source.readRange(
    entry.localHeaderOffset,
    guessedHeader + entry.compressedSize,
  );
  const view = dataView(first);
  if (view.getUint32(0, true) !== LOCAL_SIGNATURE) {
    throw new ZipError("corrupt", `${entry.name}: local header`);
  }
  const dataStart =
    LOCAL_LENGTH + view.getUint16(26, true) + view.getUint16(28, true);
  const dataEnd = dataStart + entry.compressedSize;
  let data: Uint8Array;
  if (dataEnd <= first.length) {
    data = first.subarray(dataStart, dataEnd);
  } else {
    // The first read may end inside the data, or inside the header itself.
    const inHand = first.subarray(Math.min(dataStart, first.length));
    const rest = await source.readRange(
      entry.localHeaderOffset + dataStart + inHand.length,
      entry.compressedSize - inHand.length,
    );
    data = new Uint8Array(entry.compressedSize);
    data.set(inHand);
    data.set(rest, inHand.length);
  }
  const bytes =
    entry.method === METHOD_STORED ? data : await inflateRaw(data, entry.name);
  if (bytes.length !== entry.uncompressedSize) {
    throw new ZipError(
      "corrupt",
      `${entry.name}: ${bytes.length} bytes, expected ${entry.uncompressedSize}`,
    );
  }
  return bytes;
}

async function inflateRaw(data: Uint8Array, name: string): Promise<Uint8Array> {
  try {
    const stream = new Blob([data.slice()])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new ZipError("corrupt", `${name}: ${describe(error)}`);
  }
}

// ---------------------------------------------------------------- helpers

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ZipError("corrupt", "a 64-bit field past 2^53");
  }
  return Number(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
