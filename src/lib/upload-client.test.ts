import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadImage } from "./upload-client";

// The browser's half of the upload contract (#12, shared since #72), run
// in node with fetch stubbed: which calls it makes, in what order, and how
// every answer maps to the failure the page words for the owner. The
// server's half is proven in image-upload.test.ts / archive-upload.test.ts.

type Call = { url: string; init?: RequestInit };

type Answer = { status: number; body?: unknown } | Error;

// Every PUT goes through XMLHttpRequest (progress, abort — #80), which node
// has not; this is the slice of it the uploads use, answered by the same
// table as fetch so a test describes one server for both.
function fakeXhr(answer: (call: Call) => Answer, calls: Call[]) {
  return class FakeXMLHttpRequest {
    status = 0;
    upload = { onprogress: null as null | ((e: ProgressEvent) => void) };
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    onabort: null | (() => void) = null;
    private url = "";
    private headers: Record<string, string> = {};
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send(body: File) {
      const call = {
        url: this.url,
        init: { method: "PUT", headers: this.headers, body },
      };
      calls.push(call);
      const result = answer(call);
      queueMicrotask(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: body.size,
          total: body.size,
        } as ProgressEvent);
        if (result instanceof Error) this.onerror?.();
        else {
          this.status = result.status;
          this.onload?.();
        }
      });
    }
    abort() {
      this.onabort?.();
    }
  };
}

function stubFetch(answer: (call: Call) => Answer) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      const result = answer(call);
      if (result instanceof Error) throw result;
      return new Response(
        result.body === undefined ? "" : JSON.stringify(result.body),
        { status: result.status },
      );
    }),
  );
  vi.stubGlobal("XMLHttpRequest", fakeXhr(answer, calls));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const png = new File([new Uint8Array(16)], "photo.png", { type: "image/png" });

describe("uploadImage", () => {
  it("refuses the wrong type and an empty file before any request", async () => {
    const calls = stubFetch(() => ({ status: 200 }));
    expect(
      await uploadImage(
        new File(["x"], "a.gif", { type: "image/gif" }),
        "avatar",
      ),
    ).toEqual({ ok: false, failure: "file_type" });
    expect(
      await uploadImage(new File([], "a.png", { type: "image/png" }), "avatar"),
    ).toEqual({ ok: false, failure: "file_size" });
    expect(calls).toHaveLength(0);
  });

  it("reports progress, then 1 while the server processes; a cancel or a failed PUT abandons the staged bytes (#80)", async () => {
    const progress: number[] = [];
    let calls = stubFetch(({ url }) => {
      if (url.endsWith("/api/uploads/presign")) {
        return {
          status: 200,
          body: { stagingKey: "s/9", uploadUrl: "https://bucket/put" },
        };
      }
      if (url === "https://bucket/put") return { status: 200 };
      return { status: 200, body: { original: { fileId: "f-9" } } };
    });
    expect(
      await uploadImage(png, "work", { onProgress: (f) => progress.push(f) }),
    ).toEqual({ ok: true, fileId: "f-9" });
    // The PUT's own report, then the "bytes landed" 1 before confirm.
    expect(progress).toEqual([1, 1]);
    expect(calls.map((call) => call.url)).not.toContain("/api/uploads/abandon");

    calls = stubFetch(({ url }) =>
      url === "https://bucket/put"
        ? { status: 500 }
        : {
            status: 200,
            body: { stagingKey: "s/9", uploadUrl: "https://bucket/put" },
          },
    );
    expect(await uploadImage(png, "work")).toEqual({
      ok: false,
      failure: "upload_failed",
    });
    expect(
      JSON.parse(
        String(calls.find((c) => c.url === "/api/uploads/abandon")?.init?.body),
      ),
    ).toEqual({ stagingKey: "s/9" });

    const controller = new AbortController();
    controller.abort();
    calls = stubFetch(() => ({
      status: 200,
      body: { stagingKey: "s/9", uploadUrl: "https://bucket/put" },
    }));
    expect(
      await uploadImage(png, "work", { signal: controller.signal }),
    ).toEqual({ ok: false, failure: "aborted" });
    expect(calls.map((call) => call.url)).toContain("/api/uploads/abandon");
    expect(calls.map((call) => call.url)).not.toContain("/api/uploads/confirm");
  });

  it("hands back the 480 px variant's URL when confirm names the variants (#79)", async () => {
    stubFetch(({ url }) => {
      if (url.endsWith("/api/uploads/presign")) {
        return {
          status: 200,
          body: { stagingKey: "s/1", uploadUrl: "https://bucket/put" },
        };
      }
      if (url === "https://bucket/put") return { status: 200 };
      return {
        status: 200,
        body: {
          original: { fileId: "f-1" },
          variants: [
            { kind: "work-1600", url: "https://cdn/f-1-1600.webp" },
            { kind: "work-480", url: "https://cdn/f-1-480.webp" },
          ],
        },
      };
    });
    expect(await uploadImage(png, "work")).toEqual({
      ok: true,
      fileId: "f-1",
      thumbnailUrl: "https://cdn/f-1-480.webp",
    });
  });

  it("presigns, PUTs the bytes with the signed headers, confirms with the purpose, returns the file id", async () => {
    const calls = stubFetch(({ url }) => {
      if (url.endsWith("/api/uploads/presign")) {
        return {
          status: 200,
          body: { stagingKey: "s/1", uploadUrl: "https://bucket/put" },
        };
      }
      if (url === "https://bucket/put") return { status: 200 };
      if (url.endsWith("/api/uploads/confirm")) {
        return { status: 200, body: { original: { fileId: "f-1" } } };
      }
      return { status: 404 };
    });
    expect(await uploadImage(png, "cover")).toEqual({
      ok: true,
      fileId: "f-1",
    });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/uploads/presign",
      "https://bucket/put",
      "/api/uploads/confirm",
    ]);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      sizeBytes: 16,
      contentType: "image/png",
    });
    const put = calls[1].init!;
    expect(put.method).toBe("PUT");
    expect((put.headers as Record<string, string>)["content-type"]).toBe(
      "image/png",
    );
    expect((put.headers as Record<string, string>)["cache-control"]).toContain(
      "immutable",
    );
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({
      stagingKey: "s/1",
      purpose: "cover",
    });
  });

  it("maps every refusal to its failure and stops the chain there", async () => {
    // presign: the server's code
    stubFetch(() => ({ status: 400, body: { error: "quota_exceeded" } }));
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "quota_exceeded",
    });
    // presign: rate limited
    stubFetch(() => ({ status: 429, body: {} }));
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "rate_limited",
    });
    // presign: an unknown code
    stubFetch(() => ({ status: 400, body: { error: "weird" } }));
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "generic",
    });
    // the PUT refused, and the PUT that could not be sent
    const putRefused = stubFetch(({ url }) =>
      url === "https://bucket/put"
        ? { status: 403 }
        : {
            status: 200,
            body: { stagingKey: "s/1", uploadUrl: "https://bucket/put" },
          },
    );
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "upload_failed",
    });
    expect(putRefused.map((call) => call.url)).not.toContain(
      "/api/uploads/confirm",
    );
    stubFetch(({ url }) =>
      url === "https://bucket/put"
        ? new Error("CORS")
        : {
            status: 200,
            body: { stagingKey: "s/1", uploadUrl: "https://bucket/put" },
          },
    );
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "upload_failed",
    });
    // confirm refused
    stubFetch(({ url }) =>
      url.endsWith("/api/uploads/confirm")
        ? { status: 400, body: { error: "not_an_image" } }
        : {
            status: 200,
            body: { stagingKey: "s/1", uploadUrl: "https://bucket/put" },
          },
    );
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "not_an_image",
    });
    // the network gone before presign
    stubFetch(() => new Error("offline"));
    expect(await uploadImage(png, "avatar")).toEqual({
      ok: false,
      failure: "generic",
    });
  });
});
