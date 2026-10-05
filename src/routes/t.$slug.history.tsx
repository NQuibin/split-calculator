import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$slug/history")({
  validateSearch: (search: Record<string, unknown>): { share?: string } => ({
    share: typeof search.share === "string" ? search.share : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/t/$slug/breakdown",
      params: { slug: params.slug },
      search: { share: search.share, view: "history" },
      replace: true,
    });
  },
});
