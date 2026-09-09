// #101: a zip writer for tests only — enough of the format to build the
// archives the reader must cope with: stored and deflated entries, a
// comment after the end record, ZIP64 records, data descriptors, a local
// header whose extra field is longer than the directory's, split-archive
// and encryption flags. Not for production: it holds everything in memory.

import { deflateRawSync } from "node:zlib";

export interface FixtureEntry {
  name: string;
  data?: Uint8Array;
  /** 0 stored (the default), 8 deflate, anything else written as given. */
  method?: number;
  /** Bit 0 marks encryption, bit 3 a data descriptor after the data. */
  flags?: number;
  /** Extra bytes in the local header only — the directory's stays shorter. */
  localExtraPadding?: number;
}

export interface FixtureOptions {
  comment?: string;
  /** Write the ZIP64 records and mark every 32-bit field as overflowed. */
  zip64?: boolean;
  /** The disk number written in the end record: 1 makes it a split archive. */
  disk?: number;
}

const MAX_16 = 0xffff;
const MAX_32 = 0xffffffff;

/** A fixed-layout record; every number little-endian, as the format demands. */
class Layout {
  readonly bytes: Uint8Array<ArrayBuffer>;
  private readonly view: DataView;

  constructor(length: number) {
    this.bytes = new Uint8Array(length);
    this.view = new DataView(this.bytes.buffer);
  }
  u16(at: number, value: number): this {
    this.view.setUint16(at, value, true);
    return this;
  }
  u32(at: number, value: number): this {
    this.view.setUint32(at, value, true);
    return this;
  }
  u64(at: number, value: number): this {
    this.view.setBigUint64(at, BigInt(value), true);
    return this;
  }
  put(at: number, data: Uint8Array): this {
    this.bytes.set(data, at);
    return this;
  }
}

/** A fixture entry with its bytes settled: name encoded, data compressed. */
interface Prepared {
  name: Uint8Array;
  raw: Uint8Array;
  data: Uint8Array;
  method: number;
  flags: number;
  descriptor: boolean;
  localExtra: Uint8Array;
}

function prepare(entry: FixtureEntry): Prepared {
  const method = entry.method ?? 0;
  const flags = entry.flags ?? 0;
  const raw = entry.data ?? new Uint8Array(0);
  return {
    name: new TextEncoder().encode(entry.name),
    raw,
    data: method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw,
    method,
    flags,
    descriptor: (flags & 0x0008) !== 0,
    localExtra: new Uint8Array(entry.localExtraPadding ?? 0),
  };
}

export function buildZip(
  entries: FixtureEntry[],
  options: FixtureOptions = {},
): Uint8Array<ArrayBuffer> {
  const zip64 = options.zip64 ?? false;
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries.map(prepare)) {
    const local = [localHeader(entry), entry.data];
    if (entry.descriptor) local.push(dataDescriptor(entry));
    parts.push(...local);
    directory.push(centralHeader(entry, offset, zip64));
    offset += local.reduce((sum, part) => sum + part.length, 0);
  }

  const directoryOffset = offset;
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  parts.push(...directory);
  offset += directorySize;

  if (zip64) {
    parts.push(
      zip64EndRecord(entries.length, directorySize, directoryOffset),
      zip64Locator(offset),
    );
  }
  parts.push(
    endRecord(entries.length, directorySize, directoryOffset, options),
  );
  return concat(parts);
}

function localHeader(entry: Prepared): Uint8Array {
  const { name, localExtra, descriptor } = entry;
  return new Layout(30 + name.length + localExtra.length)
    .u32(0, 0x04034b50)
    .u16(4, 20)
    .u16(6, entry.flags)
    .u16(8, entry.method)
    .u32(18, descriptor ? 0 : entry.data.length)
    .u32(22, descriptor ? 0 : entry.raw.length)
    .u16(26, name.length)
    .u16(28, localExtra.length)
    .put(30, name)
    .put(30 + name.length, localExtra).bytes;
}

function dataDescriptor(entry: Prepared): Uint8Array {
  return new Layout(16)
    .u32(0, 0x08074b50)
    .u32(8, entry.data.length)
    .u32(12, entry.raw.length).bytes;
}

function centralHeader(
  entry: Prepared,
  offset: number,
  zip64: boolean,
): Uint8Array {
  const { name } = entry;
  const extra = zip64
    ? new Layout(4 + 24)
        .u16(0, 0x0001)
        .u16(2, 24)
        .u64(4, entry.raw.length)
        .u64(12, entry.data.length)
        .u64(20, offset).bytes
    : new Uint8Array(0);
  return new Layout(46 + name.length + extra.length)
    .u32(0, 0x02014b50)
    .u16(4, 20)
    .u16(6, 20)
    .u16(8, entry.flags)
    .u16(10, entry.method)
    .u32(20, zip64 ? MAX_32 : entry.data.length)
    .u32(24, zip64 ? MAX_32 : entry.raw.length)
    .u16(28, name.length)
    .u16(30, extra.length)
    .u32(42, zip64 ? MAX_32 : offset)
    .put(46, name)
    .put(46 + name.length, extra).bytes;
}

function zip64EndRecord(
  entryCount: number,
  directorySize: number,
  directoryOffset: number,
): Uint8Array {
  return new Layout(56)
    .u32(0, 0x06064b50)
    .u64(4, 44)
    .u16(12, 45)
    .u16(14, 45)
    .u64(24, entryCount)
    .u64(32, entryCount)
    .u64(40, directorySize)
    .u64(48, directoryOffset).bytes;
}

function zip64Locator(recordAt: number): Uint8Array {
  return new Layout(20).u32(0, 0x07064b50).u64(8, recordAt).u32(16, 1).bytes;
}

function endRecord(
  entryCount: number,
  directorySize: number,
  directoryOffset: number,
  options: FixtureOptions,
): Uint8Array {
  const comment = new TextEncoder().encode(options.comment ?? "");
  const disk = options.disk ?? 0;
  const zip64 = options.zip64 ?? false;
  return new Layout(22 + comment.length)
    .u32(0, 0x06054b50)
    .u16(4, disk)
    .u16(6, disk)
    .u16(8, zip64 ? MAX_16 : entryCount)
    .u16(10, zip64 ? MAX_16 : entryCount)
    .u32(12, zip64 ? MAX_32 : directorySize)
    .u32(16, zip64 ? MAX_32 : directoryOffset)
    .u16(20, comment.length)
    .put(22, comment).bytes;
}

export function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * A fetch that serves `bytes` the way a bucket does: 206 with Content-Range
 * for a Range request, 200 with the whole body without one. Counts calls.
 */
export function rangeFetch(bytes: Uint8Array): {
  fetch: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl = async (
    _input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const range = new Headers(init?.headers).get("range");
    calls.push(range ?? "");
    const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? "");
    if (!match) {
      return new Response(bytes.slice(), { status: 200 });
    }
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), bytes.length - 1);
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        "Accept-Ranges": "bytes",
      },
    });
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}
