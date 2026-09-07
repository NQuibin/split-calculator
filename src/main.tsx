import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { BASE_PATH } from "@/lib/basePath";
import { routeTree } from "./routeTree.gen";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

const convexQueryClient = new ConvexQueryClient(import.meta.env.VITE_CONVEX_URL as string);

// Convex subscriptions are pushed into the TanStack Query cache rather than
// polled, so `staleTime: Infinity` is correct here - the WebSocket, not a
// refetch timer, is what keeps a cached result current.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
      staleTime: Infinity,
      retry: false,
    },
  },
});
convexQueryClient.connect(queryClient);

const router = createRouter({
  routeTree,
  basepath: BASE_PATH,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  // Every search param in this app is a plain string. TanStack's default
  // serializer JSON-encodes values, which would write `?count="2"` (quotes
  // included) and break `Number(params.get("count"))` in expenseDraft.ts -
  // and would not round-trip links shared from the previous build. These
  // two reproduce URLSearchParams semantics exactly, so old links keep
  // working and `names`/`ids` retain their existing inner encoding.
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith(String),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convexQueryClient.convexClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ConvexAuthProvider>
  </StrictMode>,
);
