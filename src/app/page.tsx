"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreateGroupMenu } from "@/components/CreateGroupMenu";
import { ExistingGroups } from "@/components/ExistingGroups";
import { ExistingReceipts } from "@/components/ExistingReceipts";
import { StageHeadcount } from "@/components/StageHeadcount";
import { encodeDraftParams } from "@/lib/receiptDraft";
import { generateSlug } from "@/lib/slug";
import type { Person } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConfirm(people: Person[], namePeople: boolean) {
    const slug = generateSlug();
    const params = encodeDraftParams(people, namePeople);
    startTransition(() => router.push(`/r/${slug}?${params.toString()}`));
  }

  return (
    <main className="flex flex-1 flex-col">
      <StageHeadcount
        initialPeople={[]}
        initialNamePeople={false}
        onConfirm={handleConfirm}
        pending={isPending}
      />
      <ExistingReceipts />
      <ExistingGroups />
      <div className="mx-auto w-full max-w-md px-6 pb-16">
        <CreateGroupMenu />
      </div>
    </main>
  );
}
