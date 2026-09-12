import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";

interface MemberSelectionRowProps {
  id: string;
  name: string;
  selected: boolean;
  onToggle: () => void;
  endContent?: ReactNode;
}

/** A full-row, keyboard-accessible member selector used by expense split modes. */
export function MemberSelectionRow({
  id,
  name,
  selected,
  onToggle,
  endContent,
}: MemberSelectionRowProps) {
  return (
    <label
      className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm text-ink transition-colors hover:bg-wash focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${selected ? "border-forest bg-field" : "border-edge bg-surface"}`}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" />
      <MemberAvatar id={id} name={name} />
      <span className="min-w-0 flex-1 break-words">{name}</span>
      {endContent}
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-forest bg-forest text-surface" : "border-edge bg-field text-transparent"}`}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}
