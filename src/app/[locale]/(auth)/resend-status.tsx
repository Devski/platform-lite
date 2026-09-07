import type { ResendState } from "./use-resend-verification";

// Outcome line for a resend attempt — the companion of useResendVerification,
// rendered identically by every form that offers the flow. The "sending"
// state stays on the triggering button, where each form words it in context.
export function ResendStatus({
  state,
  done,
  limited,
  failed,
}: {
  state: ResendState;
  done: string;
  limited: string;
  failed: string;
}) {
  if (state === "done") {
    return (
      <p className="type-sm text-(--state-success)" role="status">
        {done}
      </p>
    );
  }
  if (state === "limited") {
    return (
      <p className="type-sm text-(--state-danger)" role="status">
        {limited}
      </p>
    );
  }
  if (state === "failed") {
    return (
      <p className="type-sm text-(--state-danger)" role="status">
        {failed}
      </p>
    );
  }
  return null;
}
