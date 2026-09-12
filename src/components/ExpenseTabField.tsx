import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { MenuOption } from "@/components/ui/MenuOption";
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
      className="group inline-flex min-h-11 min-w-0 items-center break-words gap-1 text-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      {name}
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 self-center chevron-x" strokeWidth={2.25} />
    </Link>
  );
}

export function ExpenseTabField({ tabs, value, name, loading, locked, saved, onChange }: ExpenseTabFieldProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const label = name ?? tabs.find(tab => tab.slug === value)?.name;

  return <section className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
    <p id="expense-tab-label" className="shrink-0 text-sm text-ink-soft">
      In tab ·
    </p>
    {saved ? <p className="text-sm text-ink">{value && label ? <TabLink slug={value} name={label} /> : "Personal expense"}</p> : locked ? <>
      <p aria-labelledby="expense-tab-label" className="text-sm font-medium text-ink">{value && label ? <TabLink slug={value} name={label} /> : loading ? "Loading tab…" : "Tab unavailable"}</p>
      {/* Nothing to add once the tab is named above - the hint only earns its
          place when there is no name to show. */}
      {!label && <p className="w-full text-xs text-ink-soft">{loading ? "Loading the destination tab." : "This tab is unavailable. Return to your tabs to start a new expense."}</p>}
    </> : <>
      <div className="flex min-w-0 max-w-full items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="field" aria-labelledby="expense-tab-label expense-tab-value" aria-required="true" className="group h-auto min-h-11 min-w-0 flex-1 justify-between gap-2 rounded-md px-3 py-2" />}>
          <span id="expense-tab-value" className="truncate">{label ?? (value ? loading ? "Loading tab…" : "Tab unavailable" : "Choose a tab")}</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-soft chevron-flip" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-3rem)] rounded-lg p-2">
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            <li className="mb-1 border-b border-rule pb-1">
              <MenuOption action onClick={() => { setOpen(false); setCreating(true); }} className="justify-start font-medium text-forest">
                <Plus aria-hidden="true" className="h-4 w-4" />New tab
              </MenuOption>
            </li>
            {tabs.map(tab => <li key={tab.slug}>
              <MenuOption selected={tab.slug === value} onClick={() => { onChange(tab.slug); setOpen(false); }}>
                <span className="truncate">{tab.name}</span>
              </MenuOption>
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
        className="group inline-flex min-h-11 min-w-11 justify-center shrink-0 items-center rounded-md p-2 text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4 chevron-x" strokeWidth={2.25} />
      </Link>}
      </div>
      <CreateTabMenu variant="none" open={creating} onOpenChange={setCreating} onCreated={onChange} />
      <p className="w-full text-xs text-ink-soft">{label ? "People come from this tab. Changing tabs updates the people and their splits." : "Choose a tab or create one to add people and save this expense."}</p>
    </>}
  </section>;
}
