import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogIn, LogOut, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";

export function SidebarAccount() {
  return (
    <div className="flex items-center">
      <AuthLoading>
        {/* The 28px height matches SignedInMenu's actual row height (measured),
            so this block doesn't change height once auth resolves. */}
        <p role="status" className="flex h-7 items-center text-xs text-ink-soft">Loading…</p>
      </AuthLoading>
      <Unauthenticated>
        <SignInMenu />
      </Unauthenticated>
      <Authenticated>
        <SignedInMenu />
      </Authenticated>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

function SignInMenu() {
  const { signIn } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setStep("email");
    setEmail("");
    setPassword("");
    setFlow("signIn");
    setCode("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("password", { email, password, flow: step === "code" ? "signIn" : flow });
      if (result.signingIn) {
        setOpen(false);
        resetForm();
        return;
      }
      setCode("");
      setStep("code");
    } catch {
      setError("Couldn't continue. Check your email and password. If you previously signed in with a code only, choose Create account to set a password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn("password", { email, password, code, flow: "verify" });
      if (!result.signingIn) throw new Error("Verification failed");
      resetForm();
      setOpen(false);
    } catch {
      setError("That code isn't right, or it's expired. Try again or send a new one.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          />
        }
      >
        <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
        Sign in
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <DialogTitle>{step === "email" ? "Sign in" : "Check your email"}</DialogTitle>
          <DialogClose aria-label="Close sign in" className="rounded-md p-1.5 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></DialogClose>
        </div>
        <DialogDescription className="mb-5">
          {step === "email" ? (
            "Enter your email and password. If verification is required, we’ll email you a code. Sessions last up to 30 days."
          ) : (
            <>We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It expires in 15 minutes.</>
          )}
        </DialogDescription>

        {step === "email" ? (
          <>
            <button
              type="button"
              onClick={() => void signIn("google")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>

            <div className="my-3 flex items-center gap-2 text-xs text-ink-soft">
              <span className="h-px flex-1 bg-rule" />
              or
              <span className="h-px flex-1 bg-rule" />
            </div>

            <form onSubmit={handleSendCode} className="space-y-2">
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
              <input
                type="password"
                required
                minLength={flow === "signUp" ? 8 : undefined}
                aria-label="Password"
                placeholder={flow === "signUp" ? "Password (at least 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete={flow === "signUp" ? "new-password" : "current-password"}
              />
              <button type="button" disabled={submitting} className="text-xs text-forest underline"
                onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(null); }}>
                {flow === "signIn" ? "Create account / set your first password" : "Already have a password? Sign in"}
              </button>
              {error && <p role="alert" className="text-xs text-margin-red">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                {submitting ? "Continuing…" : flow === "signUp" ? "Create account" : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleVerifyCode} className="space-y-2">
              <input
                type="text"
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="6-digit code"
              />
              {error && <p className="text-xs text-margin-red">{error}</p>}
              <button
                type="submit"
                disabled={submitting || code.length < 6}
                className="w-full rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
              >
                {submitting ? "Verifying…" : "Sign in"}
              </button>
            </form>

            <div className="mt-3 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="font-medium text-forest underline decoration-forest/40 underline-offset-4 hover:text-ink"
              >
                Use a different email
              </button>
              <span className="text-rule">|</span>
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => void handleSendCode(e)}
                className="font-medium text-forest underline decoration-forest/40 underline-offset-4 hover:text-ink disabled:opacity-70"
              >
                Send a new code
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SignedInMenu() {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);

  return (
    <div className="flex w-full items-center gap-2">
      {viewer?.image ? (
        <img src={viewer.image} alt="" className="h-7 w-7 shrink-0 rounded-full border border-rule" referrerPolicy="no-referrer" />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-soft">
        {viewer?.name ?? viewer?.email}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sign out"
        className="shrink-0 rounded-md p-1.5 text-ink-soft transition hover:text-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <LogOut className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
