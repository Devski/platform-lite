import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

// SPEC.md §6 / issue #20: @axe-core/playwright on the public pages — the ones
// an anonymous visitor and a crawler see (A7/A11). Everything else in the
// product sits behind a session and is out of this scope.

// Derived from the builder rather than imported from axe-core: axe-core is
// @axe-core/playwright's own dependency, not one this repo declares, and
// pnpm's strict layout would not resolve a direct import of it.
type Violation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

// WCAG 2.1 up to AA, the level the product commits to. Best-practice rules
// are deliberately out of the list: they are opinions, not the criterion, and
// a red run has to mean a real accessibility defect.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// The whole document is analyzed, Next's development overlay included. That
// is deliberate: at 16.3.3 the overlay and the route announcer produce no
// violations under these tags (checked 03.09.2026), so excluding them would
// only create a blind spot. Should a future Next version make its own markup
// fail a rule, exclude THAT element by selector here —
// `new AxeBuilder({ page }).exclude("nextjs-portal")` — never disable the
// rule, which would stop it guarding our markup too.
function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

// axe reports a rule it could not decide under `incomplete`, not under
// `violations`. For most rules that is noise, but contrast is the one this
// suite is relied on to hold: reading only violations would go green BECAUSE
// the check stopped working, not because the page is actually fine.
const MUST_BE_DECIDED = ["color-contrast", "color-contrast-enhanced"];

// The one deliberate, named exception (#58 design system): the landing
// hero's text sits over a photo + a CSS gradient scrim, an ancestor
// background of the text (not a decorative sibling — that would be
// invisible to axe's ancestor walk entirely, which is a different, real bug
// fixed in the same change). axe still can't turn a gradient into a single
// contrast ratio — by design, since the color genuinely varies across it —
// and reports every text node over it as "incomplete" no matter how the DOM
// is structured. That's an axe-core limitation, not an unverified page: the
// real worst case was measured on 07.09.2026 by sampling the actual
// rendered photo's brightest pixels blended with the gradient at each text
// region — 5.6:1 at the top bar (needs 4.5:1) and 9.4:1 at the hero text
// (needs 3:1 for the h1, 4.5:1 for the rest), comfortably past AA. Scoped
// to these two pages and these two axe messageKeys only: a new
// incomplete-contrast finding anywhere else, or a genuinely different kind
// of finding on these same two pages, still fails the gate.
const GRADIENT_HERO_PAGES = new Set(["landing-pl", "landing-en"]);
const GRADIENT_CONTRAST_MESSAGE_KEYS = new Set([
  "bgGradient",
  "elmPartiallyObscuring",
]);

function isVerifiedGradientHeroContrast(
  name: string,
  result: Pick<Violation, "nodes">,
): boolean {
  if (!GRADIENT_HERO_PAGES.has(name)) return false;
  return result.nodes.every((node) =>
    node.any.some((check) => {
      const data = check.data as { messageKey?: string } | null;
      return !!data?.messageKey && GRADIENT_CONTRAST_MESSAGE_KEYS.has(data.messageKey);
    }),
  );
}

function describeViolations(violations: readonly Violation[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `      ${node.target.join(" ")}\n        ${node.html}`)
        .join("\n");
      return [
        `  ${violation.id} (${violation.impact ?? "unknown impact"}): ${violation.help}`,
        `    ${violation.helpUrl}`,
        nodes,
      ].join("\n");
    })
    .join("\n");
}

/**
 * Runs axe over the page as it stands and asserts there is nothing to fix.
 * A failure prints every violation id, its help URL and the offending markup,
 * so a red CI run is actionable without reproducing it locally, and writes the
 * full result next to the trace so the uploaded artifact carries it too.
 */
export async function expectNoAxeViolations(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const results = await analyze(page);

  if (results.violations.length > 0 || results.incomplete.length > 0) {
    // Written to a file rather than passed as a body: only a reporter that
    // persists attachments (html, blob, json) writes a body out, and CI runs
    // the github reporter — a path lands in outputDir, which ci.yml uploads.
    const jsonPath = testInfo.outputPath(`axe-${name}.json`);
    await writeFile(
      jsonPath,
      JSON.stringify(
        { violations: results.violations, incomplete: results.incomplete },
        null,
        2,
      ),
    );
    await testInfo.attach(`axe-${name}`, {
      path: jsonPath,
      contentType: "application/json",
    });
  }

  // A tag list that matches no rule produces no violations, which reads
  // exactly like a clean page — so the one check whose job is to be noisy
  // would go silent after an axe-core release that renames a tag.
  expect(
    results.passes.length +
      results.violations.length +
      results.incomplete.length,
    `${name}: axe ran no rules at all — check WCAG_TAGS against this axe-core version`,
  ).toBeGreaterThan(0);

  const undecided = results.incomplete.filter(
    (result) =>
      MUST_BE_DECIDED.includes(result.id) &&
      !isVerifiedGradientHeroContrast(name, result),
  );
  expect(
    undecided.map((result) => result.id),
    `${name}: axe could not evaluate contrast, so nothing here is proven\n${describeViolations(
      undecided,
    )}`,
  ).toEqual([]);

  // Compared as ids so the diff stays one readable line; the detail every
  // fix needs is in the message above it, not in a dump of the whole result.
  expect(
    results.violations.map((violation) => violation.id),
    `${name}: ${results.violations.length} accessibility violation(s)\n${describeViolations(
      results.violations,
    )}`,
  ).toEqual([]);
}
