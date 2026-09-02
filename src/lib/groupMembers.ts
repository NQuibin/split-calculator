import type { Person } from "./types";

export interface GroupMemberLite {
  id: string;
  name: string;
}

export function normalizeMemberName(name: string): string {
  return name.trim().toLowerCase();
}

export interface MemberMappingSuggestion {
  personId: string;
  personName: string;
  memberId?: string;
  newMemberName?: string;
}

/** Defaults each receipt person to the group member with a matching normalized
 * name, or proposes creating a new member for names that don't match anyone. */
export function suggestMemberMapping(people: Person[], members: GroupMemberLite[]): MemberMappingSuggestion[] {
  return people.map((person) => {
    const match = members.find((m) => normalizeMemberName(m.name) === normalizeMemberName(person.name));
    return match
      ? { personId: person.id, personName: person.name, memberId: match.id }
      : { personId: person.id, personName: person.name, newMemberName: person.name };
  });
}
