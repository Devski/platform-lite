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

export function buildZip(
  entries: FixtureEntry[],
  options: FixtureOptions = {},
): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const entry of entries) {
    const method = entry.method ?? 0;
    const flags = entry.flags ?? 0;
    const raw = entry.data ?? new Uint8Array(0);
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const name = encoder.encode(entry.name);
    const descriptor = (flags & 0x0008) !== 0;
    const localExtra = new Uint8Array(entry.localExtraPadding ?? 0);

    const local = new Uint8Array(30 + name.length + localExtra.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, descriptor ? 0 : data.length, true);
    lv.setUint32(22, descriptor ? 0 : raw.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, localExtra.length, true);
    local.set(name, 30);
    local.set(localExtra, 30 + name.length);
    parts.push(local, data);
    let entryLength = local.length + data.length;
    if (descriptor) {
      const trailer = new Uint8Array(16);
      const tv = new DataView(trailer.buffer);
      tv.setUint32(0, 0x08074b50, true);
      tv.setUint32(8, data.length, true);
      tv.setUint32(12, raw.length, true);
      parts.push(trailer);
      entryLength += trailer.length;
    }

    const zip64Extra = options.zip64
      ? new Uint8Array(4 + 24)
      : new Uint8Array(0);
    if (options.zip64) {
      const xv = new DataView(zip64Extra.buffer);
      xv.setUint16(0, 0x0001, true);
      xv.setUint16(2, 24, true);
      xv.setBigUint64(4, BigInt(raw.length), true);
      xv.setBigUint64(12, BigInt(data.length), true);
      xv.setBigUint64(20, BigInt(offset), true);
    }
    const central = new Uint8Array(46 + name.length + zip64Extra.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, options.zip64 ? MAX_32 : data.length, true);
    cv.setUint32(24, options.zip64 ? MAX_32 : raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, zip64Extra.length, true);
    cv.setUint32(42, options.zip64 ? MAX_32 : offset, true);
    central.set(name, 46);
    central.set(zip64Extra, 46 + name.length);
    directory.push(central);
    offset += entryLength;
  }

  const directoryOffset = offset;
  const directorySize = directory.reduce((sum, c) => sum + c.length, 0);
  parts.push(...directory);
  offset += directorySize;

  if (options.zip64) {
    const record = new Uint8Array(56);
    const rv = new DataView(record.buffer);
    rv.setUint32(0, 0x06064b50, true);
    rv.setBigUint64(4, BigInt(44), true);
    rv.setUint16(12, 45, true);
    rv.setUint16(14, 45, true);
    rv.setBigUint64(24, BigInt(entries.length), true);
    rv.setBigUint64(32, BigInt(entries.length), true);
    rv.setBigUint64(40, BigInt(directorySize), true);
    rv.setBigUint64(48, BigInt(directoryOffset), true);
    const locator = new Uint8Array(20);
    const lv = new DataView(locator.buffer);
    lv.setUint32(0, 0x07064b50, true);
    lv.setBigUint64(8, BigInt(offset), true);
    lv.setUint32(16, 1, true);
    parts.push(record, locator);
  }

  const comment = encoder.encode(options.comment ?? "");
  const end = new Uint8Array(22 + comment.length);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, options.disk ?? 0, true);
  ev.setUint16(6, options.disk ?? 0, true);
  ev.setUint16(8, options.zip64 ? MAX_16 : entries.length, true);
  ev.setUint16(10, options.zip64 ? MAX_16 : entries.length, true);
  ev.setUint32(12, options.zip64 ? MAX_32 : directorySize, true);
  ev.setUint32(16, options.zip64 ? MAX_32 : directoryOffset, true);
  ev.setUint16(20, comment.length, true);
  end.set(comment, 22);
  parts.push(end);

  return concat(parts);
}

export function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
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
