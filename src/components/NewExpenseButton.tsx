import { useTransition } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { encodeDraftParams } from "@/lib/expenseDraft";
import { generateSlug } from "@/lib/slug";
import type { Person } from "@/lib/types";

export function NewExpenseButton({ className, variant = "default" }: { className?: string; variant?: "default" | "primary" }) {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const viewer = useQuery(api.users.viewer);

  function handleStart() {
    const slug = generateSlug();
    // The signed-in starter keeps their real user id so this person stays
    // linked to their account (see expenseDraft.ts's `ids` param).
    const people: Person[] = viewer
      ? [{ id: viewer._id, name: viewer.name ?? viewer.email ?? "Person 1" }, { id: "person-2", name: "Person 2" }]
      : [
          { id: "person-1", name: "Person 1" },
          { id: "person-2", name: "Person 2" },
        ];
    const params = encodeDraftParams(people);
    startTransition(() => {
      void navigate({
        to: "/e/$slug",
        params: { slug },
        search: Object.fromEntries(params) as { count?: string; names?: string; ids?: string },
      });
    });
  }

  return (
    <Button
      type="button"
      size="touch"
      onClick={handleStart}
      disabled={isPending}
      aria-busy={isPending}
      className={className ?? (variant === "primary" ? undefined : "rounded-full")}
    >
      {variant === "primary" ? (
        <>
          {isPending ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2} />}
          New expense
        </>
      ) : (
        <>
          Split an expense
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
        </>
      )}
    </Button>
  );
}
