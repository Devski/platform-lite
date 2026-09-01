export type Mode = "totp" | "otp" | "backup";

// Turn the methods the sign-in offered (carried in the URL) into the ways the
// user can actually pass the challenge. Backup codes are only issued with an
// authenticator (TOTP) enrollment, so they ride on `totp`. Empty/absent → offer
// every way (a direct visit) and let the server reject what does not apply.
// Plain module (no "use client") so the server page can call it directly.
export function resolveModes(raw: string | undefined): Mode[] {
  const methods = raw ? raw.split(",").filter(Boolean) : ["otp", "totp"];
  const hasTotp = methods.includes("totp");
  const hasOtp = methods.includes("otp");
  const available: Mode[] = [];
  if (hasTotp) available.push("totp");
  if (hasOtp) available.push("otp");
  if (hasTotp) available.push("backup");
  return available.length > 0 ? available : ["otp"];
}
