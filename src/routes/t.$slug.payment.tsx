import { createFileRoute } from "@tanstack/react-router";
import { AccessErrorPage } from "@/components/AccessErrorPage";
import type { ExpenseView } from "@/components/ExpenseViewTabs";
import { RecordPaymentPage } from "@/pages/RecordPaymentPage";

export interface PaymentSearch {
  view: ExpenseView;
  memberId?: string;
  currency?: string;
}

export const Route = createFileRoute("/t/$slug/payment")({
  validateSearch: (search: Record<string, unknown>): PaymentSearch => ({
    view: search.view === "upcoming" || search.view === "all" ? search.view : "paid",
    ...(typeof search.memberId === "string" ? { memberId: search.memberId } : {}),
    ...(typeof search.currency === "string" ? { currency: search.currency } : {}),
  }),
  component: RecordPaymentPage,
  errorComponent: ({ error }) => <AccessErrorPage error={error} resource="tab" />,
});
