import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import type { TabListItem } from "@/lib/tabSync";

interface ExpenseTabFieldProps {
  tabs: TabListItem[];
  value: string;
  name?: string;
  loading: boolean;
  locked: boolean;
  saved: boolean;
  onChange: (slug: string) => void;
}

// The tab name doubles as a way back to the tab, so an expense always has a
// route to where it belongs - not just a saved one. The chevron marks the name
// as navigable and sits inline with it.
function TabLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      to="/t/$slug"
      params={{ slug }}
      className="group inline-flex items-baseline gap-1 text-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      {name}
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 self-center transition group-hover:translate-x-0.5" strokeWidth={2.25} />
    </Link>
  );
}

export function ExpenseTabField({ tabs, value, name, loading, locked, saved, onChange }: ExpenseTabFieldProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const label = name ?? tabs.find(tab => tab.slug === value)?.name;

  return <section className="mb-5 rounded-xl border border-rule/70 bg-surface/80 p-5 sm:p-6">
    <p id="expense-tab-label" className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wide text-ink">
      <Wallet aria-hidden="true" className="h-4 w-4 text-brass" strokeWidth={2.25} />
      Tab
    </p>
    {saved ? <p className="text-sm text-ink">{value && label ? <TabLink slug={value} name={label} /> : "Personal expense"}</p> : locked ? <>
      <p aria-labelledby="expense-tab-label" className="text-sm font-medium text-ink">{value && label ? <TabLink slug={value} name={label} /> : loading ? "Loading tab…" : "Tab unavailable"}</p>
      {/* Nothing to add once the tab is named above - the hint only earns its
          place when there is no name to show. */}
      {!label && <p className="mt-3 text-xs text-ink-soft">{loading ? "Loading the destination tab." : "This tab is unavailable. Return to your tabs to start a new expense."}</p>}
    </> : <>
      <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" aria-labelledby="expense-tab-label expense-tab-value" aria-required="true" className="h-auto min-w-0 flex-1 justify-between gap-2 rounded-md border-rule bg-surface px-3 py-2 font-normal text-ink hover:border-forest hover:bg-surface aria-expanded:border-forest aria-expanded:bg-surface" />}>
          <span id="expense-tab-value" className="truncate">{label ?? (value ? loading ? "Loading tab…" : "Tab unavailable" : "Choose a tab")}</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-soft" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-3rem)] rounded-lg border-rule bg-surface p-2">
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            <li className="mb-1 border-b border-rule pb-1">
              <button type="button" onClick={() => { setOpen(false); setCreating(true); }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-forest transition hover:bg-paper">
                <Plus aria-hidden="true" className="h-4 w-4" />New tab
              </button>
            </li>
            {tabs.map(tab => <li key={tab.slug}>
              <button type="button" aria-pressed={tab.slug === value} onClick={() => { onChange(tab.slug); setOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm text-ink transition hover:bg-paper">
                <span className="truncate">{tab.name}</span>
                {tab.slug === value && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-forest" strokeWidth={2.5} />}
              </button>
            </li>)}
            {!tabs.length && <li className="px-2 py-2 text-sm text-ink-soft">Create a tab to get started.</li>}
          </ul>
        </PopoverContent>
      </Popover>
      {/* Here the name itself belongs to the trigger (which opens the picker),
          so the chevron is its own control - same row, same meaning. */}
      {value && label && <Link
        to="/t/$slug"
        params={{ slug: value }}
        aria-label={`Go to ${label}`}
        title={`Go to ${label}`}
        className="group inline-flex shrink-0 items-center rounded-md p-2 text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={2.25} />
      </Link>}
      </div>
      <CreateTabMenu variant="none" open={creating} onOpenChange={setCreating} onCreated={onChange} />
      <p className="mt-3 text-xs text-ink-soft">{label ? "People come from this tab. Changing tabs updates the people and their splits." : "Choose a tab or create one to add people and save this expense."}</p>
    </>}
  </section>;
}
