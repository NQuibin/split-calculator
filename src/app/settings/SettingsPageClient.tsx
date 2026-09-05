"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Coins, Loader2, UserRound } from "lucide-react";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { api } from "../../../convex/_generated/api";

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

export function SettingsPageClient() {
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Back
        </button>
        <span className="font-display text-sm font-semibold tracking-wide text-brass uppercase">Settings</span>
      </div>

      <Unauthenticated>
        <p className="text-sm text-ink-soft">Sign in to manage your settings.</p>
      </Unauthenticated>
      <Authenticated>
        <div className="space-y-6">
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
    <div className="rounded-md border border-rule bg-surface p-5">
      <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
        <Coins className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Default currency
      </p>
      <p className="mb-4 text-xs text-ink-soft">
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
    <div className="rounded-md border border-rule bg-surface p-5">
      <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
        <UserRound className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Your name
      </p>
      <p className="mb-4 text-xs text-ink-soft">This is the name shown to other people in your tabs.</p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          required
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {status === "saved" && <Check className="h-4 w-4" strokeWidth={2.5} />}
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-margin-red">{error}</p>}
      {email && <p className="mt-4 text-xs text-ink-soft">Signed in as {email}</p>}
    </div>
  );
}
