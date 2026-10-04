import { useId, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { motion, useReducedMotion } from "motion/react";

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
  const selectedId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => {
        if (next === "paid" || next === "upcoming" || next === "all") onChange(next);
      }}
    >
      <Tabs.List
        aria-label={label}
        className="mb-6 inline-flex w-full max-w-full gap-1 rounded-full border border-edge bg-field p-1 md:w-auto"
      >
        {(
          [
            { value: "paid", label: "Paid" },
            { value: "upcoming", label: "Upcoming" },
            { value: "all", label: "All" },
          ] as const
        ).map((view) => (
          <Tabs.Tab
            key={view.value}
            value={view.value}
            className={`relative min-h-[calc(2.75rem-10px)] min-w-11 flex-1 shrink-0 rounded-full px-4 font-display text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-[5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:flex-none ${
              value === view.value
                ? "text-surface"
                : "text-ink-soft hover:bg-wash hover:text-forest active:bg-wash active:text-forest"
            }`}
          >
            {value === view.value && (
              <motion.span
                layoutId={`${selectedId}-selected`}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border border-forest bg-forest"
              />
            )}
            <span className="relative">{view.label}</span>
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel
        value={value}
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      >
        {children}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
