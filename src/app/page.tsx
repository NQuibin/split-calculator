"use client";

import { useRouter } from "next/navigation";
import { ExistingReceipts } from "@/components/ExistingReceipts";
import { StageHeadcount } from "@/components/StageHeadcount";
import { encodeDraftParams } from "@/lib/receiptDraft";
import { generateSlug } from "@/lib/slug";
import type { Person } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  function handleConfirm(people: Person[], namePeople: boolean) {
    const slug = generateSlug();
    const params = encodeDraftParams(people, namePeople);
    router.push(`/r/${slug}?${params.toString()}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <StageHeadcount initialPeople={[]} initialNamePeople={false} onConfirm={handleConfirm} />
      <ExistingReceipts />
    </main>
  );
}
