import path from "node:path";

// The e2e web server's stdout, on disk. The dev e-mail transport prints whole
// messages to it (src/lib/email.ts logTransport), and a Playwright worker has
// no way to read the server process's stream — so the webServer command in
// playwright.config.ts redirects the whole stream here and the DB-backed
// specs read the file (e2e/db/email-log.ts).
//
// Two spellings of one path on purpose: the command runs with the config
// directory as its cwd, so the redirection target must stay relative, while a
// worker resolves the absolute path. Both come from here so they cannot drift.
export const SERVER_LOG_RELATIVE_PATH = "test-results/dev-server.log";

export const SERVER_LOG_PATH = path.resolve(
  __dirname,
  "..",
  SERVER_LOG_RELATIVE_PATH,
);
