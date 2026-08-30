"use client";

import { useRouter } from "next/navigation";
import { ExistingReceipts } from "@/components/ExistingReceipts";
import { StageHeadcount } from "@/components/StageHeadcount";
import { generateSlug } from "@/lib/slug";
import { saveReceipt } from "@/lib/storage";
import type { Person } from "@/lib/types";

export default function Home() {
  const router = useRouter();

  function handleConfirm(people: Person[], namePeople: boolean) {
    const slug = generateSlug();
    saveReceipt(slug, {
      stage: "receipt",
      people,
      namePeople,
      items: [],
      tax: { mode: "percent", value: 0 },
      tip: { mode: "percent", value: 0 },
    });
    router.push(`/r/${slug}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <StageHeadcount initialPeople={[]} initialNamePeople={false} onConfirm={handleConfirm} />
      <ExistingReceipts />
    </main>
  );
}
