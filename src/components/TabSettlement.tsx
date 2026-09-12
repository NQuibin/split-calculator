import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, ChevronDown, HandCoins, MoveDown, MoveUp, RotateCcw, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Panel } from "@/components/ui/Page";
import { GroupTitle, SectionTitle } from "@/components/ui/Typography";
import { currency, formatExpenseDate, todayISODate } from "@/lib/format";

type Member = { id: string; name: string };
type SettlementData = NonNullable<FunctionReturnType<typeof api.settlements.get>>;
type CurrencySettlement = SettlementData["currencies"][number];
type Suggestion = CurrencySettlement["suggestions"][number];
type PaymentDraft = Suggestion & { currency: string; amountText: string; date: string; note: string };
export type SettlementSummaryData = {
  viewerMemberId: string | null;
  missingPayers: { slug: string; name: string }[];
  currencies: { currency: string; members: { memberId: string; name: string; balance: number }[] }[];
};

function BalanceValue({ balance, code, prominent = false }: { balance: number; code: string; prominent?: boolean }) {
  const color = balance > 0 ? "text-ledger-green" : balance < 0 ? "text-margin-red-ink" : "text-ink";
  const DirectionIcon = balance > 0 ? MoveUp : MoveDown;
  return <span className={`inline-flex flex-wrap items-center gap-1 ${color} ${prominent ? "text-lg font-semibold" : ""}`}>
    {balance === 0 ? "Settled" : <>{balance > 0 ? "Gets " : "Owes "}<span className="inline-flex items-center gap-1 whitespace-nowrap"><span className="font-numeric">{currency(Math.abs(balance), code)}</span><DirectionIcon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} /></span></>}
  </span>;
}

export function SettlementSummary({ data }: { data: SettlementSummaryData }) {
  return <div className="space-y-2 text-sm" aria-live="polite">
    {data.missingPayers.length > 0 && <p className="text-margin-red-ink">Balances incomplete: payer needed for {data.missingPayers.length} {data.missingPayers.length === 1 ? "expense" : "expenses"}.</p>}
    {!data.viewerMemberId ? <p className="text-ink-soft">View balances and payments</p>
      : data.currencies.length === 0 ? <p className="text-ink-soft">{data.missingPayers.length ? "Assign payers to calculate what everyone owes." : "No outstanding balances."}</p>
        : <div className="space-y-3">{[...data.currencies[0].members].sort((a, b) => Number(b.memberId === data.viewerMemberId) - Number(a.memberId === data.viewerMemberId)).map(member => {
          const isViewer = member.memberId === data.viewerMemberId;
          return <div key={member.memberId} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><MemberAvatar id={member.memberId} name={member.name} size="sm" /><span className="min-w-0 break-words">{member.name}{isViewer && <span className="text-ink-soft"> (you)</span>}</span></span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{data.currencies.map(group => {
              const balance = group.members.find(candidate => candidate.memberId === member.memberId)?.balance;
              return <span key={group.currency} className="inline-flex items-center gap-2"><span className="text-xs text-ink-soft">{group.currency}</span>{balance === undefined ? "No balance" : <BalanceValue balance={balance} code={group.currency} prominent={isViewer} />}</span>;
            })}</div>
          </div>;
        })}</div>}
  </div>;
}

export function TabSettlement({ slug, members, isOwner }: { slug: string; members: Member[]; isOwner: boolean }) {
  const [day, setDay] = useState(todayISODate);
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [reversingId, setReversingId] = useState<SettlementData["history"][number]["id"] | null>(null);
  const [status, setStatus] = useState("");
  const requestId = useRef("");
  const submitting = useRef(false);
  const data = useQuery(api.settlements.get, { slug, asOfDate: day });
  const record = useMutation(api.settlements.record);
  const reverse = useMutation(api.settlements.reverse);

  useEffect(() => {
    const refresh = () => setDay(todayISODate());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  function beginPayment(suggestion: Suggestion, code: string) {
    requestId.current = crypto.randomUUID();
    setPaymentError(null);
    setPayment({ ...suggestion, currency: code, amountText: String(suggestion.amount), date: day, note: "" });
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payment || submitting.current) return;
    const amount = Number(payment.amountText);
    if (!Number.isFinite(amount) || amount <= 0) { setPaymentError("Enter an amount greater than zero."); return; }
    if (!payment.date || payment.date > day) { setPaymentError("Choose a payment date on or before today."); return; }
    submitting.current = true;
    setPaymentPending(true);
    setPaymentError(null);
    try {
      await record({
        slug, fromMemberId: payment.fromMemberId, toMemberId: payment.toMemberId, amount,
        currency: payment.currency, date: payment.date, note: payment.note.trim() || undefined,
        requestId: requestId.current, asOfDate: day,
      });
      setPayment(null);
      setStatus("Payment recorded. Balances updated.");
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Couldn’t record payment.");
    } finally {
      submitting.current = false;
      setPaymentPending(false);
    }
  }

  if (data === undefined) return <Panel className="mb-6 p-5" role="region" aria-label="Settle up"><SectionTitle>Settle up</SectionTitle><p role="status" className="mt-2 text-sm text-ink-soft">Loading settlement balances…</p></Panel>;
  if (data === null) return null;

  const memberName = (id: string) => members.find(member => member.id === id)?.name ?? "Unknown member";
  const reverseHistory = data.history.find(item => item.id === reversingId);
  return <Panel className="mb-6 p-5" role="region" aria-label="Settle up">
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle className="flex items-center gap-2"><HandCoins aria-hidden="true" className="h-5 w-5 text-brass" />Settle up</SectionTitle>
        <DialogTrigger render={<Button variant="outline" size="touch" className="group" />}>View payments <ChevronDown aria-hidden="true" className="h-4 w-4 chevron-y" /></DialogTrigger>
      </div>
      <SettlementSummary data={data} />
      <p className="mt-3 text-xs text-ink-soft">Paid expenses only · Upcoming expenses excluded · Currencies settled separately</p>
      <DialogContent className="max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><DialogTitle>Settle up</DialogTitle><DialogDescription className="mt-1">Paid expenses through {formatExpenseDate(day)}. Record transfers already made outside the app.</DialogDescription></div>
          <DialogClose aria-label="Close settlement" render={<Button variant="ghost" size="icon-touch" />}><X aria-hidden="true" /></DialogClose>
        </div>
        {data.missingPayers.length > 0 && <div className="mt-4 rounded-md border border-rule bg-field p-3 text-sm">
          <p className="text-margin-red-ink">These expenses are excluded until a payer is assigned:</p>
          <ul className="mt-2 space-y-1">{data.missingPayers.map(expense => <li key={expense.slug} className="break-words">
            {isOwner ? <Button variant="link" size="touch" className="h-auto whitespace-normal px-0 text-left" render={<Link to="/e/$slug" params={{ slug: expense.slug }} />}>{expense.name || "Untitled expense"}</Button> : expense.name || "Untitled expense"}
          </li>)}</ul>
        </div>}
        {data.currencies.length === 0 && <p className="mt-5 text-sm text-ink-soft">{data.missingPayers.length ? "Assign payers to see settlement suggestions." : "No outstanding balances."}</p>}
        <div className="mt-5 space-y-5">{data.currencies.map(group => <section key={group.currency} aria-label={`${group.currency} balances`}>
          <GroupTitle as="h3">{group.currency}</GroupTitle>
          <ul className="mt-3 divide-y divide-rule rounded-lg border border-edge bg-field">{group.members.map(member => <li key={member.memberId} className="flex flex-wrap justify-between gap-3 px-3 py-3 text-sm">
            <span className="min-w-0 break-words">{member.name}</span><BalanceValue balance={member.balance} code={group.currency} />
          </li>)}</ul>
          {group.suggestions.length > 0 && <div className="mt-4">
            <GroupTitle as="h4">Suggested transfers</GroupTitle>
            <ul className="mt-2 space-y-3">{group.suggestions.map(suggestion => <li key={`${suggestion.fromMemberId}-${suggestion.toMemberId}`} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 break-words">{memberName(suggestion.fromMemberId)} <ArrowRight aria-hidden="true" className="mx-1 inline h-3.5 w-3.5" /> {memberName(suggestion.toMemberId)}</span>
              <span className="font-numeric whitespace-nowrap">{currency(suggestion.amount, group.currency)}</span>
              {isOwner && <Button variant="outline" size="touch" onClick={() => beginPayment(suggestion, group.currency)}>Record payment</Button>}
            </li>)}</ul>
          </div>}
        </section>)}</div>
        <section className="mt-5 border-t border-rule pt-4">
          <GroupTitle as="h3">Payment history</GroupTitle>
          {!data.history.length && <p className="mt-2 text-sm text-ink-soft">No payments recorded yet.</p>}
          <ul className="mt-2 space-y-3">{data.history.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 text-sm">
            <div className="min-w-0 flex-1 break-words"><p>{memberName(item.fromMemberId)} → {memberName(item.toMemberId)}</p><p className="text-xs text-ink-soft">{formatExpenseDate(item.date)} · {item.currency}{item.reversed ? " · Reversed" : ""}</p>{item.note && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{item.note}</p>}</div>
            <span className="font-numeric whitespace-nowrap">{currency(item.amount, item.currency)}</span>
            {isOwner && !item.reversed && <Button variant="destructive" size="touch" aria-label={`Reverse ${currency(item.amount, item.currency)} payment from ${memberName(item.fromMemberId)} to ${memberName(item.toMemberId)}`} onClick={() => setReversingId(item.id)}><RotateCcw aria-hidden="true" />Reverse</Button>}
          </li>)}</ul>
        </section>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={reversingId !== null}
      onOpenChange={next => { if (!next) setReversingId(null); }}
      title="Reverse this payment?"
      description={reverseHistory ? `${memberName(reverseHistory.fromMemberId)}’s ${currency(reverseHistory.amount, reverseHistory.currency)} payment to ${memberName(reverseHistory.toMemberId)} will be reversed. The history entry stays visible and balances are recalculated.` : "This payment will be reversed."}
      confirmLabel="Reverse payment"
      pendingLabel="Reversing…"
      onConfirm={async () => { if (reversingId) { await reverse({ slug, settlementId: reversingId }); setStatus("Payment reversed. Balances updated."); } }}
    />
    {payment && <Dialog open onOpenChange={next => { if (!next && !submitting.current) { setPayment(null); setPaymentError(null); } }}>
      <DialogContent>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription className="mt-1">{memberName(payment.fromMemberId)} → {memberName(payment.toMemberId)} · {payment.currency}. This records money already transferred.</DialogDescription>
        <form onSubmit={savePayment} className="mt-5 space-y-4" aria-busy={paymentPending}>
          <fieldset disabled={paymentPending} className="space-y-4">
            <div><Label htmlFor="settlement-amount">Amount ({payment.currency})</Label><Input id="settlement-amount" type="number" inputMode="decimal" step="0.01" min="0.01" className="font-numeric" value={payment.amountText} onChange={event => setPayment({ ...payment, amountText: event.target.value })} aria-invalid={!!paymentError} aria-describedby={paymentError ? "settlement-error" : "settlement-amount-help"} required /><p id="settlement-amount-help" className="mt-1 text-xs text-ink-soft">You can record a partial payment.</p></div>
            <div><Label htmlFor="settlement-date">Payment date</Label><DatePicker id="settlement-date" value={payment.date} onChange={date => setPayment({ ...payment, date })} aria-label="Payment date" /></div>
            <div><Label htmlFor="settlement-note">Note (optional)</Label><Textarea id="settlement-note" maxLength={2000} value={payment.note} onChange={event => setPayment({ ...payment, note: event.target.value })} /></div>
          </fieldset>
          {paymentError && <FieldError id="settlement-error">{paymentError}</FieldError>}
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" size="touch" disabled={paymentPending} onClick={() => { setPayment(null); setPaymentError(null); }}>Cancel</Button><Button type="submit" size="touch" disabled={paymentPending} aria-busy={paymentPending}>{paymentPending ? "Recording…" : "Record payment"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>}
    {status && <p className="mt-2 text-xs text-ink-soft" role="status">{status}</p>}
  </Panel>;
}
