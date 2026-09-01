"use client";

// Browser-side counterpart of lib/api-route: one JSON POST shape for the
// app's own /api endpoints. Network-level failures still throw — callers
// keep their catch for that.
export async function postJson<Data>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: Data }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    ok: response.ok,
    status: response.status,
    data: (await response.json()) as Data,
  };
}
