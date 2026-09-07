import { createFileRoute } from "@tanstack/react-router";
import { SharedExpensePage } from "@/pages/SharedExpensePage";

// The return type is annotated with optional keys so links to this route
// aren't forced to pass `search` - TanStack derives that requirement from
// validateSearch's return type.
export const Route = createFileRoute("/s")({
  // `d` carries the whole shared expense as an encoded payload.
  validateSearch: (search: Record<string, unknown>): { d?: string } => ({
    d: (search.d as string) || undefined,
  }),
  component: SharedExpensePage,
});
