"use client";

import { Check, HatGlasses } from "lucide-react";

interface PersonChipProps {
  name: string;
  selected: boolean;
  onToggle: () => void;
  anonymous?: boolean;
}

export function PersonChip({ name, selected, onToggle, anonymous = false }: PersonChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-margin-red ${
        selected
          ? "border-forest bg-forest text-surface"
          : "border-rule text-ink-soft hover:border-forest hover:text-forest"
      }`}
    >
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {name}
      {anonymous && (
        <HatGlasses className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-label="Anonymous member" />
      )}
    </button>
  );
}
