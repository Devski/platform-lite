import { notFound } from "next/navigation";

// Every address under [locale] that no other route claims: /foo/bar,
// /settings/x, /some-profile/works. Without this file such an address never
// reaches [locale]/not-found.tsx — Next hands an unmatched URL only to a root
// not-found, and this app's root layout sits under the [locale] segment — so
// it got Next's own English 404 with no way back (F-SHELL-3 in
// docs/ui-specification.md). Throwing here renders the same localized 404 a
// missing profile gets, inside the locale layout.
//
// A single segment never lands here: [handle] is the more specific match, and
// the profile page answers an unknown address itself. The root params give the
// not-found body its locale (src/i18n/request.ts), so nothing is set here.
export default function UnmatchedAddress() {
  notFound();
}
