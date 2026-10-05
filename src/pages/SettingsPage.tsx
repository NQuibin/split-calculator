import { type FormEvent, useState } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Banknote, Check, Loader2, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageDescription, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { Field, Input } from "@/components/ui/Input";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { api } from "../../convex/_generated/api";
import { EmptyState, Page, Panel } from "@/components/ui/Page";
import { Skeleton } from "@/components/ui/Skeleton";

export function SettingsPage() {
  return (
    <Page>
      <header className="mb-8">
        <PageTitle>Settings</PageTitle>
        <PageDescription>Manage your profile and preferences.</PageDescription>
      </header>

      <AuthLoading>
        <SettingsSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <EmptyState status={false}>Sign in to manage your settings.</EmptyState>
      </Unauthenticated>
      <Authenticated>
        <SettingsContent />
      </Authenticated>
    </Page>
  );
}

function SettingsSkeleton() {
  return (
    <Panel role="status" aria-label="Loading settings" className="divide-y divide-rule/70">
      <div className="space-y-4 px-5 py-6 sm:px-6">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-11 rounded-md" />
        </div>
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-11 rounded-md" />
        </div>
      </div>
      <div className="space-y-4 px-5 py-6 sm:px-6">
        <Skeleton className="h-5 w-28 rounded-md" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        <div className="max-w-sm space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-11 rounded-md" />
        </div>
      </div>
      <div className="flex justify-end px-5 py-5 sm:px-6">
        <Skeleton className="h-11 w-full rounded-lg sm:w-28" />
      </div>
    </Panel>
  );
}

function SettingsContent() {
  const viewer = useQuery(api.users.viewer);
  if (viewer === undefined) return <SettingsSkeleton />;
  return (
    <SettingsForm
      key={viewer?._id}
      initialName={viewer?.name ?? ""}
      initialCurrency={viewer?.defaultCurrency ?? DEFAULT_CURRENCY}
      email={viewer?.email}
    />
  );
}

function SettingsForm({
  initialName,
  initialCurrency,
  email,
}: {
  initialName: string;
  initialCurrency: string;
  email?: string;
}) {
  const updateSettings = useMutation(api.users.updateSettings);
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [savedValues, setSavedValues] = useState({ name: initialName, currency: initialCurrency });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== savedValues.name || currency !== savedValues.currency;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (!dirty) return;
    setError(null);
    setStatus("saving");
    try {
      await updateSettings({ name: trimmed, currency });
      setSavedValues({ name: trimmed, currency });
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update settings.");
      setStatus("idle");
    }
  }

  return (
    <Panel>
      <form onSubmit={handleSubmit} className="divide-y divide-rule/70">
        <div className="px-5 py-6 sm:px-6">
          <SectionTitle className="mb-2">Profile</SectionTitle>
          <p className="mb-5 text-sm text-ink-soft">Your name is shown to friends in your tabs.</p>
          <div className="max-w-sm space-y-5">
            <Field label="Your name" htmlFor="settings-name" icon={UserRound}>
              <Input
                id="settings-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setStatus("idle");
                  setError(null);
                }}
              />
            </Field>
            <Field label="Email" htmlFor="settings-email" icon={Mail}>
              <Input
                id="settings-email"
                type="email"
                value={email ?? ""}
                readOnly
                className="bg-paper text-ink-soft"
              />
            </Field>
          </div>
        </div>
        <div className="px-5 py-6 sm:px-6">
          <SectionTitle className="mb-2">Preferences</SectionTitle>
          <p className="mb-5 text-sm text-ink-soft">
            New expenses you start outside of a tab begin in this currency.
          </p>
          <Field
            label="Default currency"
            htmlFor="settings-currency"
            icon={Banknote}
            className="max-w-sm"
          >
            <CurrencyPicker
              id="settings-currency"
              value={currency}
              onChange={(code) => {
                setCurrency(code);
                setStatus("idle");
                setError(null);
              }}
              aria-label="Default currency"
              className="w-full"
            />
          </Field>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {status === "saved" && (
            <span role="status" className="flex items-center gap-1 text-sm text-forest">
              <Check className="size-4" /> Saved
            </span>
          )}
          {error && (
            <p role="alert" className="text-xs text-margin-red-ink">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="touch"
            disabled={!dirty || status === "saving"}
            aria-busy={status === "saving"}
            className="w-full sm:w-auto"
          >
            {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
