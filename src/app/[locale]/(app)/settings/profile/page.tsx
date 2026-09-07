import { redirect } from "@/i18n/navigation";

// #58 folded this screen away: the name and the photo are edited straight on
// the owner's own profile page, and the address moved next to the rest of the
// account identity. The route survives as a redirect so bookmarks, old
// e-mails and anything else still pointing here land somewhere.
//
// It stays inside (app) on purpose — the layout's session gate sends a
// signed-out visitor to the login page rather than bouncing them through a
// settings address they cannot open.
export default async function ProfileSettingsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/settings/account", locale });
  // redirect() throws; the return only keeps the component a ReactNode.
  return null;
}
