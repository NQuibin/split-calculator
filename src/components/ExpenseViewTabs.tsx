import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";

export type ExpenseView = "paid" | "upcoming" | "all";

export function ExpenseViewTabs({ value, onChange, label, children }: {
  value: ExpenseView;
  onChange: (value: ExpenseView) => void;
  label: string;
  children: ReactNode;
}) {
  return <Tabs.Root value={value} onValueChange={next => {
    if (next === "paid" || next === "upcoming" || next === "all") onChange(next);
  }}>
    <Tabs.List aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-rule">
      {([{ value: "paid", label: "Paid" }, { value: "upcoming", label: "Upcoming" }, { value: "all", label: "All" }] as const).map(view =>
        <Tabs.Tab key={view.value} value={view.value} className="shrink-0 border-b-2 border-transparent px-4 py-3 font-display text-sm font-medium text-ink-soft transition hover:text-forest data-active:border-forest data-active:text-forest focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest">{view.label}</Tabs.Tab>
      )}
    </Tabs.List>
    <Tabs.Panel value={value} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">{children}</Tabs.Panel>
  </Tabs.Root>;
}
