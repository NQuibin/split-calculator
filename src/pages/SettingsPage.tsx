import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Check, Coins, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { api } from "../../convex/_generated/api";
import { EmptyState, Page, Panel } from "@/components/ui/Page";

export function SettingsPage() {
  return (
    <Page>
      <header className="mb-8">
        <PageTitle>Settings</PageTitle>
        <PageDescription>Manage your profile and preferences.</PageDescription>
      </header>

      <AuthLoading>
        <EmptyState>Loading settings…</EmptyState>
      </AuthLoading>
      <Unauthenticated>
        <EmptyState status={false}>Sign in to manage your settings.</EmptyState>
      </Unauthenticated>
      <Authenticated>
        <Panel className="divide-y divide-rule/70">
          <NameSettings />
          <DefaultCurrencySettings />
        </Panel>
      </Authenticated>
    </Page>
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
      <SectionTitle className="mb-2 flex items-center gap-2">
        <Coins className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Default currency
      </SectionTitle>
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
      <SectionTitle className="mb-2 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Your name
      </SectionTitle>
      <p className="mb-5 text-sm text-ink-soft">This is the name shown to friends in your tabs.</p>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-wrap items-center gap-3 sm:flex-nowrap">
        <Input
          type="text"
          required
          placeholder="Your name"
          aria-label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type="submit"
          size="hero"
          disabled={status === "saving"}
          aria-busy={status === "saving"}
          className="shrink-0"
        >
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {status === "saved" && <Check className="h-4 w-4" strokeWidth={2.5} />}
          Save
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-margin-red-ink">{error}</p>}
      {email && <p className="mt-4 text-sm text-ink-soft break-words">Signed in as {email}</p>}
    </div>
  );
}
