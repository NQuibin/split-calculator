import type { ReactNode } from "react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { CheckboxRow } from "@/components/ui/CheckboxRow";

interface MemberSelectionRowProps {
  id: string;
  name: string;
  selected: boolean;
  onToggle: () => void;
  endContent?: ReactNode;
  content?: ReactNode;
  ground?: "surface" | "field";
}

/** A full-row, keyboard-accessible member selector used by expense split modes. */
export function MemberSelectionRow({
  id,
  name,
  selected,
  onToggle,
  endContent,
  content,
  ground = "surface",
}: MemberSelectionRowProps) {
  return (
    <CheckboxRow selected={selected} onCheckedChange={onToggle} ground={ground}>
      <MemberAvatar id={id} name={name} />
      {content ?? <span className="min-w-0 flex-1 break-words">{name}</span>}
      {endContent}
    </CheckboxRow>
  );
}
