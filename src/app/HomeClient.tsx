"use client";

import { Users } from "lucide-react";
import { CreateTabMenu } from "@/components/CreateTabMenu";
import { NewExpenseButton } from "@/components/NewExpenseButton";

export function HomeClient() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex items-center gap-2 text-brass">
        <Users className="h-6 w-6" strokeWidth={2.25} />
        <span className="font-display text-base font-semibold tracking-wide uppercase">Split Calculator</span>
      </div>
      <p className="max-w-sm text-sm text-ink-soft">
        Pick an expense or tab from the sidebar, or start something new.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <NewExpenseButton />
        <CreateTabMenu />
      </div>
    </main>
  );
}
