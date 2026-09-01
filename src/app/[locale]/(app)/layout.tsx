import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "@/lib/auth";

// Every signed-in page is per-request (it reads the session) and never static.
// getAuth() also needs APP_URL, which the build does not provide — without
// this the prerender pass evaluates it and fails. force-dynamic covers the
// whole (app) subtree, so pages here render only at request time.
export const dynamic = "force-dynamic";

// Session gate for every signed-in page (settings now, profile later). A
// session that cannot be verified — including a preview environment with no
// database at all — counts as signed out: fail closed, land on the login page.
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let signedIn = false;
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    signedIn = session !== null;
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect({ href: "/login", locale });
  return children;
}
