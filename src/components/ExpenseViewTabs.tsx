import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

export type ExpenseView = "paid" | "upcoming" | "all";

export function ExpenseViewTabs({
  value,
  onChange,
  label,
  children,
}: {
  value: ExpenseView;
  onChange: (value: ExpenseView) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      label={label}
      options={[
        { value: "paid", label: "Paid" },
        { value: "upcoming", label: "Upcoming" },
        { value: "all", label: "All" },
      ]}
    >
      {children}
    </SegmentedTabs>
  );
}
