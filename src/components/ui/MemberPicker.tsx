import { Button } from "@/components/ui/Button";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { MenuOption } from "@/components/ui/MenuOption";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { MemberAvatar } from "@/components/MemberAvatar";

export interface MemberPickerOption {
  id: string;
  name: string;
}

interface MemberPickerProps {
  id: string;
  labelId: string;
  value?: string;
  placeholder: string;
  members: MemberPickerOption[];
  onChange: (id: string) => void;
  "aria-required"?: boolean;
  "aria-invalid"?: "true";
  "aria-describedby"?: string;
}

export function MemberPicker({
  id,
  labelId,
  value,
  placeholder,
  members,
  onChange,
  ...aria
}: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = members.find((member) => member.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="field"
            aria-labelledby={`${labelId} ${id}-value`}
            className="group min-h-11 w-full justify-between rounded-md px-3 py-2 text-base sm:text-sm"
            {...aria}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selected && (
            <span aria-hidden="true">
              <MemberAvatar id={selected.id} name={selected.name} size="sm" />
            </span>
          )}
          <span id={`${id}-value`} className="min-w-0 truncate">
            {selected?.name ?? placeholder}
          </span>
        </span>
        <DropdownChevron />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-3rem)] rounded-lg p-2">
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {members.map((member) => (
            <li key={member.id}>
              <MenuOption
                selected={member.id === value}
                onClick={() => {
                  onChange(member.id);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true">
                    <MemberAvatar id={member.id} name={member.name} size="sm" />
                  </span>
                  <span className="min-w-0 truncate">{member.name}</span>
                </span>
              </MenuOption>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
import { useState } from "react";
