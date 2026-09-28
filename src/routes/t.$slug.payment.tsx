import { createFileRoute } from "@tanstack/react-router";
import { AccessErrorPage } from "@/components/AccessErrorPage";
import type { ExpenseView } from "@/components/ExpenseViewTabs";
import { RecordPaymentPage } from "@/pages/RecordPaymentPage";

export interface PaymentSearch {
  view: ExpenseView;
}

export const Route = createFileRoute("/t/$slug/payment")({
  validateSearch: (search: Record<string, unknown>): PaymentSearch => ({
    view: search.view === "upcoming" || search.view === "all" ? search.view : "paid",
  }),
  component: RecordPaymentPage,
  errorComponent: ({ error }) => <AccessErrorPage error={error} resource="tab" />,
});
