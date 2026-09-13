import { avatarColorIndex, avatarColors } from "@/lib/avatarColors";

function memberInitials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return (
    words.length > 1
      ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`
      : Array.from(words[0] ?? "?")[0]
  )
    .toLocaleUpperCase()
    .slice(0, 2);
}

const avatarSizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-11 w-11 text-sm",
};

/**
 * The colour is a hash of `id`, so it is deterministic - but only as stable as
 * the id the caller passes. Inside a tab, always pass the **tab member (seat)
 * id**: `id` on a tab's members, `personId`/`people[].id` on an expense, and
 * `createdBy.id`, which the server maps back to the creator's seat for exactly
 * this reason. Every participant has a seat whether or not they have claimed an
 * account, so one person keeps one colour across the roster, the expense list
 * and the breakdown.
 *
 * Do *not* pass `resolvedId`. It is an account id for claimed members and a
 * seat id for anonymous ones, so a claimed member came out a different colour
 * beside seat-keyed avatars in the same row. It still exists for identity
 * remapping and balance grouping - it is just not a colour key.
 *
 * Colour is therefore stable within a tab, not across tabs: the same person
 * holds a different seat in each tab, so their colour changes between them.
 */
export function MemberAvatar({
  id,
  name,
  size = "md",
  className = "",
}: {
  /** The person's resolved identity - see above. Not a tab-local member id. */
  id: string;
  name: string;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  const colorIndex = avatarColorIndex(id);
  return (
    <span
      // `role="img"` is what makes the label reach assistive tech: on a bare
      // span aria-label is dropped, and the initials alone don't name anyone.
      role="img"
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarSizes[size]} ${avatarColors[colorIndex]} ${className}`}
    >
      {memberInitials(name)}
    </span>
  );
}
