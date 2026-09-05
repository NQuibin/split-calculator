const avatarColors = [
  "bg-[#f1d9d3] text-[#923e37]",
  "bg-[#d7e4ed] text-[#32648a]",
  "bg-[#dbe5d2] text-[#3d6045]",
  "bg-[#e1dcf0] text-[#65528d]",
  "bg-[#e9e8d9] text-[#62684e]",
];

function memberInitials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return (words.length > 1
    ? `${Array.from(words[0])[0]}${Array.from(words[words.length - 1])[0]}`
    : Array.from(words[0] ?? "?")[0]).toLocaleUpperCase().slice(0, 2);
}

export function MemberAvatar({ id, name }: { id: string; name: string }) {
  const colorIndex = Array.from(id).reduce((sum, char) => sum + char.codePointAt(0)!, 0) % avatarColors.length;
  return <span title={name} aria-label={name} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[colorIndex]}`}>{memberInitials(name)}</span>;
}

