"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import {
  Check,
  Coins,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Receipt as ExpenseIcon,
  Trash2,
  Unlink,
  Users2,
  VenetianMask,
} from "lucide-react";
import { AssignExpenseDialog } from "@/components/AssignExpenseDialog";
import { TabBreakdown } from "@/components/TabBreakdown";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { BASE_PATH } from "@/lib/basePath";
import { computeSplit } from "@/lib/calculations";
import { currency } from "@/lib/format";
import {
  useTab,
  useTabActions,
  useTabBreakdown,
  useTabInviteLinks,
  useTabExpenses,
} from "@/lib/tabSync";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { useExpenseActions } from "@/lib/expenseSync";
import { generateSlug } from "@/lib/slug";

const inputClass =
  "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-margin-red/40";

export function TabPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const tab = useTab(slug);
  const breakdown = useTabBreakdown(slug);
  const expenses = useTabExpenses(slug);

  if (tab === undefined) return null;
  if (tab === null) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-ink-soft">This tab doesn&rsquo;t exist.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-end">
        <span className="font-display text-sm font-semibold tracking-wide text-brass uppercase">Tab</span>
      </div>

      {token && <ClaimBanner slug={slug} token={token} />}

      <TabTitle slug={slug} name={tab.name} isOwner={tab.isOwner} />
      {tab.isOwner && <TabDefaultCurrency slug={slug} currency={tab.defaultCurrency} />}

      <div className="mt-6 space-y-6">
        <Roster slug={slug} isOwner={tab.isOwner} members={tab.members} />
        {breakdown?.currencies.map((c) => (
          <TabBreakdown
            key={c.currency}
            tabSlug={slug}
            breakdown={c}
            showCurrencyBadge={breakdown.currencies.length > 1}
          />
        ))}
        <ExpenseList slug={slug} isOwner={tab.isOwner} members={tab.members} expenses={expenses} />
      </div>
    </main>
  );
}

function ClaimBanner({ slug, token }: { slug: string; token: string }) {
  const { isAuthenticated } = useConvexAuth();
  const { claimMember } = useTabActions();
  const hasClaimed = useRef(false);
  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || hasClaimed.current) return;
    hasClaimed.current = true;
    setStatus("claiming");
    claimMember({ slug, token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Couldn't claim this invite.");
      });
  }, [isAuthenticated, slug, token, claimMember]);

  if (status === "done") return null;

  return (
    <div className="mb-6 rounded-md border border-rule bg-surface p-4">
      <Unauthenticated>
        <p className="text-sm text-ink">
          You&rsquo;ve been invited to this tab. Sign in above to claim your spot.
        </p>
      </Unauthenticated>
      <Authenticated>
        <p className="flex items-center gap-2 text-sm text-ink">
          {status === "claiming" && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
          {status === "error" ? (message ?? "Couldn't claim this invite.") : "Claiming your spot…"}
        </p>
      </Authenticated>
    </div>
  );
}

function TabTitle({ slug, name, isOwner }: { slug: string; name: string; isOwner: boolean }) {
  const { rename } = useTabActions();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    await rename({ slug, name: trimmed });
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSubmit}
          className={`${inputClass} font-display max-w-sm text-2xl font-semibold`}
        />
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">{name}</h1>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            aria-label="Rename tab"
            className="cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-forest"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
      {isOwner && <DeleteTabButton slug={slug} />}
    </div>
  );
}

function TabDefaultCurrency({ slug, currency: currencyCode }: { slug: string; currency: string }) {
  const { setDefaultCurrency } = useTabActions();

  return (
    <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
      <Coins className="h-3.5 w-3.5 shrink-0 text-brass" strokeWidth={2.25} />
      <span>Default currency for new expenses</span>
      <CurrencyPicker
        value={currencyCode}
        onChange={(code) => setDefaultCurrency({ slug, currency: code })}
        aria-label="Tab default currency"
      />
    </div>
  );
}

function DeleteTabButton({ slug }: { slug: string }) {
  const router = useRouter();
  const { deleteTab } = useTabActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTab({ slug });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the tab.");
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {error && <span className="text-xs text-margin-red">{error}</span>}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-busy={deleting}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-margin-red px-2.5 py-1.5 text-xs font-semibold text-margin-red transition hover:bg-margin-red hover:text-surface disabled:cursor-not-allowed disabled:opacity-70"
        >
          {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />}
          Confirm delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="cursor-pointer text-xs font-medium text-ink-soft transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-70"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Delete tab"
      className="shrink-0 cursor-pointer rounded-md p-1.5 text-ink-soft transition hover:text-margin-red"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

function Roster({
  slug,
  isOwner,
  members,
}: {
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean }[];
}) {
  const { addMember } = useTabActions();
  const inviteLinks = useTabInviteLinks(slug, isOwner);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await addMember({ slug, name: trimmed });
    setNewName("");
    setAdding(false);
  }

  function copyInvite(memberId: string, token: string) {
    const url = `${window.location.origin}${BASE_PATH}/t/${slug}?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(memberId);
    setTimeout(() => setCopiedId((id) => (id === memberId ? null : id)), 2000);
  }

  return (
    <div className="rounded-md border border-rule bg-surface p-5">
      <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
        <Users2 className="h-4 w-4 text-brass" strokeWidth={2.25} />
        Members
      </p>
      <ul className="space-y-2 text-sm">
        {members.map((member) => {
          const invite = inviteLinks.find((l) => l.memberId === member.id);
          return (
            <li key={member.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ink">
                {member.name}
                {!member.claimed && (
                  <VenetianMask
                    className="h-3.5 w-3.5 shrink-0 text-ink-soft"
                    strokeWidth={2.25}
                    aria-label="Anonymous member"
                  />
                )}
              </span>
              {isOwner && !member.claimed && invite && (
                <button
                  type="button"
                  onClick={() => copyInvite(member.id, invite.token)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
                >
                  {copiedId === member.id ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Copy invite
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {members.some((m) => !m.claimed) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
          <VenetianMask className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          Anonymous members haven&rsquo;t signed up yet — invite them to claim their spot.
        </p>
      )}

      {isOwner &&
        (adding ? (
          <form onSubmit={handleAdd} className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-md bg-forest px-3 py-2 text-sm font-semibold text-surface transition hover:bg-ink"
            >
              Add
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-medium text-forest hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add member
          </button>
        ))}
    </div>
  );
}

function ExpenseList({
  slug,
  isOwner,
  members,
  expenses,
}: {
  slug: string;
  isOwner: boolean;
  members: { id: string; name: string; claimed: boolean }[];
  expenses: ReturnType<typeof useTabExpenses>;
}) {
  const router = useRouter();
  const { unassignExpense } = useTabActions();
  const { remove } = useExpenseActions();

  function handleNewExpense() {
    const newSlug = generateSlug();
    const params = encodeDraftParams(members, true);
    router.push(`/e/${newSlug}?${params.toString()}&tab=${slug}`);
  }

  return (
    <div className="rounded-md border border-rule bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-display text-sm font-semibold tracking-wide text-ink uppercase">
          <ExpenseIcon className="h-4 w-4 text-brass" strokeWidth={2.25} />
          Expenses
        </p>
        {isOwner && (
          <div className="flex items-center gap-2">
            <AssignExpenseDialog tabSlug={slug} members={members} />
            <button
              type="button"
              onClick={handleNewExpense}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-forest"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              New expense
            </button>
          </div>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-ink-soft">No expenses yet.</p>
      ) : (
        <ul className="space-y-2">
          {expenses.map((expense) => {
            const total = computeSplit(expense.people, expense.items).grandTotal;
            return (
              <li key={expense.slug} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/e/${expense.slug}`)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-rule bg-surface px-4 py-3 text-left text-sm transition hover:border-forest"
                >
                  <span className="truncate text-ink">{expense.name}</span>
                  <span className="font-numeric shrink-0 font-semibold text-ink">
                    {currency(total, expense.currency)}
                  </span>
                </button>
                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => unassignExpense({ expenseSlug: expense.slug })}
                      aria-label="Remove from tab"
                      title="Remove from tab"
                      className="shrink-0 cursor-pointer rounded-md p-2 text-ink-soft transition hover:text-forest"
                    >
                      <Unlink className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(expense.slug)}
                      aria-label="Delete expense"
                      title="Delete expense"
                      className="shrink-0 cursor-pointer rounded-md p-2 text-ink-soft transition hover:text-margin-red"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
