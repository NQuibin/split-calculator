"use client";

import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Check, Coins, Loader2, UserRound } from "lucide-react";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { api } from "../../../convex/_generated/api";

const inputClass =
  "w-full min-w-0 rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/20";

export function SettingsPageClient() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 md:px-10 md:py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-ink-soft">Manage your profile and preferences.</p>
      </header>

      <AuthLoading>
        <p role="status" className="rounded-xl border border-dashed border-rule bg-surface/60 px-6 py-10 text-center text-sm text-ink-soft">Loading settings…</p>
      </AuthLoading>
      <Unauthenticated>
        <p className="rounded-xl border border-dashed border-rule bg-surface/60 px-6 py-10 text-center text-sm text-ink-soft">Sign in to manage your settings.</p>
      </Unauthenticated>
      <Authenticated>
        <div className="divide-y divide-rule/70 overflow-hidden rounded-xl border border-rule/70 bg-surface/80">
          <NameSettings />
          <DefaultCurrencySettings />
        </div>
      </Authenticated>
    </main>
  );
}

function NameSettings() {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return null;
  return <NameForm key={viewer?._id} initialName={viewer?.name ?? ""} email={viewer?.email} />;
}

function DefaultCurrencySettings() {
  const viewer = useQuery(api.users.viewer);
  const updateDefaultCurrency = useMutation(api.users.updateDefaultCurrency);
  const [saved, setSaved] = useState(false);

  if (viewer === undefined) return null;
  const currency = viewer?.defaultCurrency ?? DEFAULT_CURRENCY;

  async function handleChange(code: string) {
    await updateDefaultCurrency({ currency: code });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
        <Coins className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Default currency
      </h2>
      <p className="mb-5 text-sm text-ink-soft">
        New expenses you start outside of a tab begin in this currency.
      </p>
      <div className="flex items-center gap-2">
        <CurrencyPicker value={currency} onChange={handleChange} aria-label="Default currency" />
        {saved && <Check className="h-4 w-4 text-forest" strokeWidth={2.5} />}
      </div>
    </div>
  );
}

function NameForm({ initialName, email }: { initialName: string; email?: string }) {
  const updateName = useMutation(api.users.updateName);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      await updateName({ name: trimmed });
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your name.");
      setStatus("idle");
    }
  }

  return (
    <div className="px-5 py-6 sm:px-6">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
        <UserRound className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Your name
      </h2>
      <p className="mb-5 text-sm text-ink-soft">This is the name shown to friends in your tabs.</p>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-wrap items-center gap-3 sm:flex-nowrap">
        <input
          type="text"
          required
          placeholder="Your name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-forest px-5 py-3 font-display font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {status === "saved" && <Check className="h-4 w-4" strokeWidth={2.5} />}
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-margin-red">{error}</p>}
      {email && <p className="mt-4 text-sm text-ink-soft break-words">Signed in as {email}</p>}
    </div>
  );
}
