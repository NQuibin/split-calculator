"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogIn, LogOut } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSyncLocalReceiptsOnLogin } from "@/lib/receiptSync";

export function Header() {
  useSyncLocalReceiptsOnLogin();

  return (
    <header className="flex justify-end px-6 py-3">
      <AuthLoading>
        <div className="h-8 w-8" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <SignedInMenu />
      </Authenticated>
    </header>
  );
}

function SignInButton() {
  const { signIn } = useAuthActions();

  return (
    <button
      type="button"
      onClick={() => void signIn("google")}
      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
    >
      <LogIn className="h-3.5 w-3.5" strokeWidth={2.25} />
      Sign in with Google
    </button>
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
