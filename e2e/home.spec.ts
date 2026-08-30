import { expect, test } from "@playwright/test";

test("homepage renders the placeholder heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "platform-lite" }),
  ).toBeVisible();
});
