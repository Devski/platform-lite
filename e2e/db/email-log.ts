import { readFile, stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { SERVER_LOG_PATH } from "../server-log";

// Reading the dev mailbox. src/lib/email.ts's log transport prints the whole
// message — subject and body, action link included — to the server's stdout,
// which playwright.config.ts redirects into a file (e2e/server-log.ts). The
// production code stays untouched by the harness: no file transport, no test
// hook, nothing that exists only for e2e.
//
// The exact shape written per message:
//
//   [email] to=<address>
//   [email] subject=<subject>
//   <body, several lines, with the action URL on a line of its own>

const ADDRESS_MARKER = "[email] to=";
// Nothing clears the log between runs — Playwright empties outputDir, which is
// one level below it — so the file merely existing says nothing. Anything last
// written before this process started belongs to an earlier run.
const RUN_STARTED_AT = Date.now() - process.uptime() * 1000;
const POLL_INTERVAL_MS = 200;
const DEFAULT_TIMEOUT_MS = 20_000;

// Any absolute http(s) URL; the caller narrows to the link it wants.
const URL_PATTERN = /https?:\/\/\S+/g;

interface DeliveredMessage {
  to: string;
  /** Everything from this message's marker to the start of the next one. */
  text: string;
}

/** Every message in the log, oldest first. */
function parseMessages(log: string): DeliveredMessage[] {
  const messages: DeliveredMessage[] = [];
  let index = log.indexOf(ADDRESS_MARKER);
  while (index !== -1) {
    const next = log.indexOf(ADDRESS_MARKER, index + ADDRESS_MARKER.length);
    const text = next === -1 ? log.slice(index) : log.slice(index, next);
    const addressEnd = text.indexOf("\n");
    messages.push({
      to: text
        .slice(
          ADDRESS_MARKER.length,
          addressEnd === -1 ? undefined : addressEnd,
        )
        .trim(),
      text,
    });
    index = next;
  }
  return messages;
}

interface WaitOptions {
  to: string;
  /** Names the message in the failure text — a timeout means it never came. */
  what: string;
  timeoutMs?: number;
}

async function waitFor<T>(
  options: WaitOptions,
  looking: string,
  pick: (messages: DeliveredMessage[]) => T | undefined,
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let logIsFromThisRun = false;
  for (;;) {
    const lastWrite = await stat(SERVER_LOG_PATH)
      .then((stats) => stats.mtimeMs)
      .catch(() => undefined);
    if (lastWrite !== undefined && lastWrite >= RUN_STARTED_AT)
      logIsFromThisRun = true;
    const log =
      lastWrite === undefined
        ? undefined
        : await readFile(SERVER_LOG_PATH, "utf8").catch(() => undefined);
    if (log !== undefined) {
      // Newest first: a resend supersedes the message before it.
      const found = pick(
        parseMessages(log)
          .filter((message) => message.to === options.to)
          .reverse(),
      );
      if (found !== undefined) return found;
    }
    if (Date.now() >= deadline) break;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(
    [
      `No ${options.what} e-mail for ${options.to} within ${timeoutMs} ms.`,
      `Looked for ${looking} in ${SERVER_LOG_PATH}.`,
      logIsFromThisRun
        ? "This run wrote to the log, so the server ran but never sent that message."
        : "Nothing was written to the log during this run: Playwright reused a dev server it did not start (stop yours and re-run), or the server never came up.",
    ].join("\n"),
  );
}

/**
 * Waits for the newest message to `to` carrying a link that matches
 * `linkPattern`, and answers with that link.
 */
export function waitForEmailLink(
  options: WaitOptions & { linkPattern: RegExp },
): Promise<string> {
  return waitFor(options, `a ${String(options.linkPattern)} link`, (messages) =>
    messages
      .map((message) =>
        message.text
          .match(URL_PATTERN)
          // search(), not test(): it ignores a caller's stray /g flag instead
          // of carrying lastIndex from one candidate URL into the next.
          ?.findLast((url) => url.search(options.linkPattern) !== -1),
      )
      .find((link) => link !== undefined),
  );
}

/**
 * Waits for the newest message to `to` whose text matches `pattern` — for the
 * notifications that carry no link at all, such as the A3 password-change
 * confirmation. Answers with the whole message.
 */
export function waitForEmail(
  options: WaitOptions & { pattern: RegExp },
): Promise<string> {
  return waitFor(
    options,
    `text matching ${String(options.pattern)}`,
    (messages) =>
      messages.find((message) => message.text.search(options.pattern) !== -1)
        ?.text,
  );
}
