import { Link } from "@tanstack/react-router";
import { Lock, LogIn, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { accessErrorCode } from "@/lib/accessError";
import { PageTitle } from "@/components/ui/Typography";
import { Page } from "@/components/ui/Page";

/** What the caller was trying to open, so the copy can name it. */
export type AccessResource = "tab" | "expense";

const label: Record<AccessResource, string> = { tab: "tab", expense: "expense" };

/**
 * The page a route falls back to when its Convex queries refuse to answer.
 * Access failures get a forbidden (or sign-in) page; anything else is a real
 * bug and gets the generic error state rather than being dressed up as a
 * permissions problem.
 */
export function AccessErrorPage({ error, resource }: { error: unknown; resource: AccessResource }) {
  const code = accessErrorCode(error);

  if (code === "unauthenticated") {
    return (
      <Shell
        icon={<LogIn className="h-6 w-6" strokeWidth={2.25} />}
        title="Sign in to view this"
        body={`This ${label[resource]} is private. Sign in with the account it was shared with to open it.`}
        tone="forest"
      />
    );
  }

  if (code === "forbidden") {
    return (
      <Shell
        icon={<Lock className="h-6 w-6" strokeWidth={2.25} />}
        title="You don't have access"
        body={
          resource === "tab"
            ? "This tab belongs to someone else. Ask them for an invite link and you'll be able to open it."
            : "This expense belongs to someone else. Only the people on its tab can open it."
        }
        tone="red"
      />
    );
  }

  return (
    <Shell
      icon={<TriangleAlert className="h-6 w-6" strokeWidth={2.25} />}
      title="Something went wrong"
      body={`We couldn't load this ${label[resource]}. Try again in a moment.`}
      tone="red"
    />
  );
}

function Shell({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "forest" | "red";
}) {
  return (
    <Page width="narrow" center>
      <div className="rounded-xl border border-rule/70 bg-surface/80 px-6 py-8 text-center sm:px-8">
        <span
          aria-hidden="true"
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
            tone === "forest" ? "bg-forest/10 text-forest" : "bg-margin-red/10 text-margin-red-ink"
          }`}
        >
          {icon}
        </span>
        <PageTitle className="mt-5 text-2xl">{title}</PageTitle>
        <p className="mx-auto mt-3 max-w-sm text-sm text-ink-soft">{body}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button size="touch" render={<Link to="/tabs" />}>
            Go to your tabs
          </Button>
          <Button variant="outline" size="touch" render={<Link to="/" />}>
            Home
          </Button>
        </div>
      </div>
    </Page>
  );
}
