import { expect, test } from "@playwright/test";

// DB-less smoke for the #12 avatar routes: the fail-closed session gate must
// answer 401 (never 500) even with no database at all. The pipeline itself is
// covered by src/lib/avatar.test.ts; the browser UI arrives with #14.

test("the avatar routes refuse an unauthenticated caller with 401", async ({
  request,
}) => {
  const presign = await request.post("/api/uploads/presign", {
    data: { sizeBytes: 1234, contentType: "image/png" },
  });
  expect(presign.status()).toBe(401);

  const confirm = await request.post("/api/uploads/confirm", {
    data: { stagingKey: "staging/nobody/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  });
  expect(confirm.status()).toBe(401);
});
