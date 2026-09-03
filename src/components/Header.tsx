"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogIn, LogOut, Settings } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSyncLocalReceiptsOnLogin } from "@/lib/receiptSync";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Skeleton } from "@/components/ui/skeleton";

export function Header() {
  useSyncLocalReceiptsOnLogin();

  return (
    <header className="flex justify-end px-6 py-3">
      <AuthLoading>
        {/* Matches SignedInMenu's actual row height (28px, measured) so the
            header doesn't change height once auth resolves. */}
        <Skeleton className="h-7 w-24 rounded-full" />
      </AuthLoading>
      <Unauthenticated>
        <SignInMenu />
      </Unauthenticated>
      <Authenticated>
        <SignedInMenu />
      </Authenticated>
    </header>
  );
}

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

function SignInMenu() {
  const { signIn } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setFlow("signIn");
    setEmail("");
    setPassword("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, flow });
      setOpen(false);
    } catch {
      setError(
        flow === "signIn"
          ? "Incorrect email or password."
          : "Couldn't create an account with that email — it may already be taken.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          />
        }
      >
        <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
        Sign in
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border border-rule bg-surface p-4">
        <button
          type="button"
          onClick={() => void signIn("google")}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <GoogleIcon className="h-4 w-4" />
          Sign in with Google
        </button>

        <div className="my-3 flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
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
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          />
          {error && <p className="text-xs text-margin-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
          >
            {submitting ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setFlow((f) => (f === "signIn" ? "signUp" : "signIn"));
            setError(null);
          }}
          className="mt-3 cursor-pointer text-xs font-medium text-forest underline decoration-forest/40 underline-offset-4 hover:text-ink"
        >
          {flow === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function SignedInMenu() {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);

  return (
    <div className="flex items-center gap-2">
      {viewer?.image ? (
        <img src={viewer.image} alt="" className="h-7 w-7 rounded-full border border-rule" referrerPolicy="no-referrer" />
      ) : null}
      <span className="max-w-32 truncate text-xs font-medium text-ink-soft">
        {viewer?.name ?? viewer?.email}
      </span>
      <Link
        href="/settings"
        aria-label="Settings"
        className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <Settings className="h-4 w-4" strokeWidth={2.25} />
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sign out"
        className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
      >
        <LogOut className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
