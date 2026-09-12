import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogIn, LogOut, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";

export function SidebarAccount() {
  return (
    <div className="flex items-center">
      <AuthLoading>
        {/* The 28px height matches SignedInMenu's actual row height (measured),
            so this block doesn't change height once auth resolves. */}
        <p role="status" className="flex min-h-11 items-center text-xs text-ink-soft">Loading…</p>
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
        render={<Button type="button" variant="outline" size="touch" className="w-full" />}
      >
        <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
        Sign in
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <DialogTitle>{step === "email" ? "Sign in" : "Check your email"}</DialogTitle>
          <DialogClose
            aria-label="Close sign in"
            render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
          >
            <X className="h-4 w-4" />
          </DialogClose>
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
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void signIn("google")}
              className="w-full"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </Button>

            <div className="my-3 flex items-center gap-2 text-xs text-ink-soft">
              <span className="h-px flex-1 bg-rule" />
              or
              <span className="h-px flex-1 bg-rule" />
            </div>

            <form onSubmit={handleSendCode} className="space-y-2">
              <Input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                type="password"
                required
                minLength={flow === "signUp" ? 8 : undefined}
                aria-label="Password"
                placeholder={flow === "signUp" ? "Password (at least 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={flow === "signUp" ? "new-password" : "current-password"}
              />
              <Button type="button" variant="link" size="xs" disabled={submitting}
                className="h-auto justify-start px-0 text-xs font-normal underline"
                onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(null); }}>
                {flow === "signIn" ? "Create account / set your first password" : "Already have a password? Sign in"}
              </Button>
              {error && <p role="alert" className="text-xs text-margin-red-ink">{error}</p>}
              <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting} className="w-full">
                {submitting ? "Continuing…" : flow === "signUp" ? "Create account" : "Continue"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleVerifyCode} className="space-y-2">
              <Input
                type="text"
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-lg tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="6-digit code"
              />
              {error && <p className="text-xs text-margin-red-ink">{error}</p>}
              <Button
                type="submit"
                size="lg"
                disabled={submitting || code.length < 6}
                aria-busy={submitting}
                className="w-full"
              >
                {submitting ? "Verifying…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-3 flex items-center gap-3 text-xs">
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="h-auto px-0 text-xs underline decoration-forest/40 underline-offset-4 hover:text-ink"
              >
                Use a different email
              </Button>
              <span className="text-rule">|</span>
              <Button
                type="button"
                variant="link"
                size="xs"
                disabled={submitting}
                onClick={(e) => void handleSendCode(e)}
                className="h-auto px-0 text-xs underline decoration-forest/40 underline-offset-4 hover:text-ink"
              >
                Send a new code
              </Button>
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
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        onClick={() => void signOut()}
        aria-label="Sign out"
        className="shrink-0 text-ink-soft hover:text-margin-red-ink"
      >
        <LogOut className="h-4 w-4" strokeWidth={2.25} />
      </Button>
    </div>
  );
}
