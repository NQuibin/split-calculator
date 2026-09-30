import { useState } from "react";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { CheckboxRow } from "@/components/ui/CheckboxRow";
import { FieldError, Input, Label } from "@/components/ui/Input";
import { MemberSelectionRow } from "@/components/ui/MemberSelectionRow";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Page, Panel } from "@/components/ui/Page";
import { Breadcrumb, BreadcrumbCurrent, crumbLinkClass } from "@/components/ui/Breadcrumb";
import { GroupTitle, PageTitle, SectionTitle } from "@/components/ui/Typography";
import { todayISODate } from "@/lib/format";
import { useLocaleFormatters } from "@/lib/localeFormatters";
import { useTab } from "@/lib/tabSync";

const route = getRouteApi("/t/$slug/payment");
type SettlementResponse = NonNullable<FunctionReturnType<typeof api.settlements.get>>;
type SettlementQueryResponse = SettlementResponse | SettlementResponse["paid"];
type PaymentMember = {
  memberId: string;
  name: string;
  currency: string;
  balance: number;
};
type PaymentDraft = { amount: string };
type PaymentSection = {
  key: string;
  choice: PaymentMember;
  draft: PaymentDraft;
  paymentCents: number;
  validAmount: boolean;
  memberBalanceCapacity: number;
  error: string | null;
  valid: boolean;
};

function paymentKey(choice: PaymentMember) {
  return `${choice.memberId}:${choice.currency}`;
}

function paymentId(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/gu, "-");
}

export function RecordPaymentPage() {
  const { slug } = route.useParams();
  const { view } = route.useSearch();
  const tab = useTab(slug);
  const [day] = useState(todayISODate);
  const response = useQuery(api.settlements.get, { slug, asOfDate: day }) as
    | SettlementQueryResponse
    | null
    | undefined;
  const recordSettlement = useMutation(api.settlements.recordMany);
  const navigate = useNavigate();
  const { currency } = useLocaleFormatters();
  const [stage, setStage] = useState<"select" | "details">("select");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = response ? ("paid" in response ? response[view] : response) : undefined;
  const choices: PaymentMember[] =
    data?.currencies.flatMap((group) =>
      group.members
        .filter(
          (member) =>
            member.memberId !== data.viewerMemberId &&
            (member.balanceWithViewer ?? member.balance) !== 0,
        )
        .map((member) => ({
          memberId: member.memberId,
          name: member.name,
          currency: group.currency,
          balance: member.balanceWithViewer ?? member.balance,
        })),
    ) ?? [];
  const choiceGroups =
    data?.currencies.flatMap(({ currency: code }) => {
      const members = choices.filter((choice) => choice.currency === code);
      return members.length > 0 ? [{ code, members }] : [];
    }) ?? [];
  const selectedChoices = choices.filter((choice) => selectedKeys.includes(paymentKey(choice)));
  const sections: PaymentSection[] = selectedChoices.map((choice) => {
    const key = paymentKey(choice);
    const draft = drafts[key] ?? { amount: "" };
    const enteredAmountCents = Number(draft.amount) * 100;
    const paymentCents = Math.round(enteredAmountCents);
    const validAmount =
      Number.isFinite(enteredAmountCents) &&
      Number.isSafeInteger(paymentCents) &&
      paymentCents > 0 &&
      Math.abs(enteredAmountCents - paymentCents) < 1e-6;
    const memberBalanceCapacity = Math.round(Math.abs(choice.balance) * 100);
    const error =
      draft.amount === ""
        ? null
        : !validAmount
          ? "Enter a positive amount with up to two decimal places."
          : paymentCents > memberBalanceCapacity
            ? "Payment cannot exceed the direct balance with this member."
            : null;
    return {
      key,
      choice,
      draft,
      paymentCents,
      validAmount,
      memberBalanceCapacity,
      error,
      valid: validAmount && paymentCents <= memberBalanceCapacity,
    };
  });
  const canSubmit = sections.length > 0 && sections.every((section) => section.valid);

  function toggleChoice(choice: PaymentMember) {
    const key = paymentKey(choice);
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((selected) => selected !== key) : [...current, key],
    );
  }

  function updateDraft(key: string, update: Partial<PaymentDraft>) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { amount: "" }), ...update },
    }));
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.viewerMemberId || !canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await recordSettlement({
        slug,
        asOfDate: day,
        view,
        payments: sections.map(({ choice, paymentCents }) => ({
          fromMemberId: (choice.balance > 0
            ? choice.memberId
            : data.viewerMemberId) as Id<"tabMembers">,
          toMemberId: (choice.balance > 0
            ? data.viewerMemberId
            : choice.memberId) as Id<"tabMembers">,
          amount: paymentCents / 100,
          currency: choice.currency,
          date: day,
          requestId: crypto.randomUUID(),
        })),
      });
      await navigate({ to: "/t/$slug", params: { slug }, replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record payment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      <Breadcrumb>
        <Link to="/tabs" className={crumbLinkClass}>
          Tabs
        </Link>
        <Link to="/t/$slug" params={{ slug }} className={crumbLinkClass}>
          {tab?.name ?? "Tab"}
        </Link>
        <BreadcrumbCurrent>Record payment</BreadcrumbCurrent>
      </Breadcrumb>
      <PageTitle className="mb-6">Record payment</PageTitle>
      {stage === "details" && (
        <Button
          type="button"
          variant="link"
          size="touch"
          className="mb-4 self-start px-0"
          onClick={() => setStage("select")}
          disabled={pending}
        >
          ← Change member
        </Button>
      )}
      <Panel className="card-inset">
        {response === undefined || tab === undefined ? (
          <p role="status" className="text-sm text-ink-soft">
            Loading payment details…
          </p>
        ) : response === null || tab === null ? (
          <p className="text-sm text-ink-soft">This tab doesn’t exist.</p>
        ) : !data?.viewerMemberId ? (
          <p className="text-sm text-ink-soft">Payment recording isn’t available.</p>
        ) : stage === "select" ? (
          <div className="space-y-4">
            <div>
              <SectionTitle>Choose a member</SectionTitle>
              <p className="mt-1 text-sm text-ink-soft">Select one or more balances to record.</p>
            </div>
            {choices.length === 0 ? (
              <p className="text-sm text-ink-soft">No eligible balances to record.</p>
            ) : (
              <div className="space-y-4">
                {choiceGroups.map((group) => (
                  <section key={group.code} aria-labelledby={`payment-currency-${group.code}`}>
                    <GroupTitle
                      as="h3"
                      id={`payment-currency-${group.code}`}
                      className="mb-2 inline-flex rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink"
                    >
                      {group.code}
                    </GroupTitle>
                    <ul className="space-y-2">
                      {group.members.map((choice) => (
                        <li key={choice.memberId}>
                          <MemberSelectionRow
                            id={choice.memberId}
                            name={choice.name}
                            selected={selectedKeys.includes(paymentKey(choice))}
                            onToggle={() => toggleChoice(choice)}
                            ground="field"
                            content={
                              <span className="min-w-0 flex-1 break-words">
                                {choice.balance > 0 ? (
                                  <>
                                    <span className="font-medium">{choice.name}</span> owes you{" "}
                                  </>
                                ) : (
                                  <>
                                    You owe <span className="font-medium">{choice.name}</span>{" "}
                                  </>
                                )}
                                <span
                                  className={`font-numeric font-semibold ${choice.balance > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                                >
                                  {currency(Math.abs(choice.balance), choice.currency)}
                                </span>
                              </span>
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                size="touch"
                className="w-full sm:w-auto"
                onClick={() => setStage("details")}
                disabled={pending || selectedKeys.length === 0}
              >
                Continue →
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {sections.map((section) => (
              <section
                key={section.key}
                className="space-y-4 border-t border-rule pt-5 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar id={section.choice.memberId} name={section.choice.name} />
                    <div className="min-w-0">
                      <SectionTitle>
                        {section.choice.balance > 0
                          ? `${section.choice.name} pays you`
                          : `You pay ${section.choice.name}`}
                      </SectionTitle>
                      <p
                        className={`mt-1 text-sm ${section.choice.balance > 0 ? "text-ledger-green" : "text-margin-red-ink"}`}
                      >
                        {section.choice.balance > 0 ? "You are owed" : "You owe"}{" "}
                        <span className="font-numeric font-semibold">
                          {currency(Math.abs(section.choice.balance), section.choice.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-rule bg-chip-neutral px-3 py-1 font-numeric text-xs font-semibold text-ink">
                    {section.choice.currency}
                  </span>
                </div>
                <div>
                  <Label htmlFor={`payment-amount-${paymentId(section.key)}`}>Amount</Label>
                  <Input
                    id={`payment-amount-${paymentId(section.key)}`}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={section.draft.amount}
                    onChange={(event) => updateDraft(section.key, { amount: event.target.value })}
                    className="font-numeric"
                    aria-describedby={
                      section.error ? `payment-error-${paymentId(section.key)}` : undefined
                    }
                    aria-invalid={section.error !== null}
                  />
                  {section.error && (
                    <FieldError id={`payment-error-${paymentId(section.key)}`}>
                      {section.error}
                    </FieldError>
                  )}
                  <CheckboxRow
                    selected={
                      section.validAmount && section.paymentCents === section.memberBalanceCapacity
                    }
                    onCheckedChange={(checked) =>
                      updateDraft(section.key, {
                        amount: checked ? (section.memberBalanceCapacity / 100).toFixed(2) : "",
                      })
                    }
                    layout="compact"
                    className="mt-2"
                  >
                    Record full amount
                  </CheckboxRow>
                </div>
              </section>
            ))}
            {error && <FieldError>{error}</FieldError>}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="touch"
                className="w-full sm:w-auto"
                disabled={pending || !canSubmit}
                aria-busy={pending}
              >
                {pending ? "Saving…" : "Record payment"}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </Page>
  );
}
