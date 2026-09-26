import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { KeyRound, Mail, LogIn, LogOut, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input, Label } from "@/components/ui/Input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";

export function SidebarAccount() {
  return (
    <div className="flex items-center">
      <AuthLoading>
        {/* The 28px height matches SignedInMenu's actual row height (measured),
            so this block doesn't change height once auth resolves. */}
        <p role="status" className="flex min-h-11 items-center text-xs text-ink-soft">
          Loading…
        </p>
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
  const [newPassword, setNewPassword] = useState("");
  const [flow, setFlow] = useState<"signIn" | "signUp" | "reset">("signIn");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setStep("email");
    setEmail("");
    setPassword("");
    setNewPassword("");
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
      const requestedFlow = flow === "reset" ? "reset" : step === "code" ? "signIn" : flow;
      const result = await signIn("password", {
        email,
        password,
        flow: requestedFlow,
      });
      if (result.signingIn) {
        setOpen(false);
        resetForm();
        return;
      }
      setCode("");
      setStep("code");
    } catch {
      setError(
        flow === "reset"
          ? "We couldn't send a reset code. Try again in a moment."
          : "Couldn't continue. Check your email and password. If you previously signed in with a code only, choose Create account to set a password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn(
        "password",
        flow === "reset"
          ? { email, newPassword, code, flow: "reset-verification" }
          : { email, password, code, flow: "verify" },
      );
      if (!result.signingIn) throw new Error("Verification failed");
      resetForm();
      setOpen(false);
    } catch {
      setError(
        flow === "reset"
          ? "That code isn't right, has expired, or the password is invalid. Try again or send a new code."
          : "That code isn't right, or it's expired. Try again or send a new one.",
      );
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
        render={<Button type="button" variant="secondary" size="touch" className="w-full" />}
      >
        <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
        Sign in
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <DialogTitle>
            {step === "email"
              ? flow === "reset"
                ? "Reset password"
                : "Sign in"
              : "Check your email"}
          </DialogTitle>
          <DialogClose
            aria-label="Close sign in"
            render={<Button variant="ghost" size="icon-touch" className="text-ink-soft" />}
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <DialogDescription className="mb-5">
          {step === "email" ? (
            flow === "reset" ? (
              "Enter your email and we’ll send a code if an account exists for it."
            ) : (
              "Enter your email and password. If verification is required, we’ll email you a code. Sessions last up to 30 days."
            )
          ) : (
            <>
              We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It
              expires in 15 minutes.
            </>
          )}
        </DialogDescription>

        {step === "email" ? (
          <>
            <Button
              type="button"
              variant="secondary"
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

            <form onSubmit={handleSendCode} className="space-y-3">
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  icon={Mail}
                />
              </div>
              {flow !== "reset" && (
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    required
                    minLength={flow === "signUp" ? 8 : undefined}
                    aria-label="Password"
                    placeholder={
                      flow === "signUp" ? "Password (at least 8 characters)" : "Password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={flow === "signUp" ? "new-password" : "current-password"}
                    icon={KeyRound}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {flow !== "reset" && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    disabled={submitting}
                    className="h-auto justify-start px-0 text-xs font-normal underline"
                    onClick={() => {
                      setFlow(flow === "signIn" ? "signUp" : "signIn");
                      setError(null);
                    }}
                  >
                    {flow === "signIn"
                      ? "Create account / set your first password"
                      : "Already have a password? Sign in"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  disabled={submitting}
                  className="h-auto justify-start px-0 text-xs font-normal underline"
                  onClick={() => {
                    setFlow(flow === "reset" ? "signIn" : "reset");
                    setError(null);
                  }}
                >
                  {flow === "reset" ? "Back to sign in" : "Forgot password?"}
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-xs text-margin-red-ink">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full"
              >
                {submitting
                  ? "Continuing…"
                  : flow === "signUp"
                    ? "Create account"
                    : flow === "reset"
                      ? "Send reset code"
                      : "Continue"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleVerifyCode} className="space-y-2">
              <Label htmlFor="signin-code">Verification code</Label>
              <Input
                id="signin-code"
                type="text"
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-lg tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby="signin-code-help"
              />
              <p id="signin-code-help" className="text-xs text-ink-soft">
                Enter the 6-digit code from your email.
              </p>
              {flow === "reset" && (
                <div>
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="New password (at least 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    icon={KeyRound}
                  />
                </div>
              )}
              {error && <p className="text-xs text-margin-red-ink">{error}</p>}
              <Button
                type="submit"
                size="lg"
                disabled={
                  submitting || code.length < 6 || (flow === "reset" && newPassword.length < 8)
                }
                aria-busy={submitting}
                className="w-full"
              >
                {submitting ? "Verifying…" : flow === "reset" ? "Reset password" : "Sign in"}
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
                className="h-auto px-0 text-xs underline decoration-forest/40 underline-offset-4 hover:text-ink active:text-ink"
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
                className="h-auto px-0 text-xs underline decoration-forest/40 underline-offset-4 hover:text-ink active:text-ink"
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
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  return (
    <>
      <div className="flex w-full items-center gap-2">
        {viewer?.image ? (
          <img
            src={viewer.image}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full border border-rule"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-soft">
          {viewer?.name ?? viewer?.email}
        </span>
        <Button
          type="button"
          variant="destructive-icon"
          size="icon-touch"
          onClick={() => setConfirmingSignOut(true)}
          aria-label="Sign out"
          title="Sign out"
          className="shrink-0"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title="Sign out?"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        pendingLabel="Signing out…"
        onConfirm={async () => {
          await signOut();
        }}
      />
    </>
  );
}
