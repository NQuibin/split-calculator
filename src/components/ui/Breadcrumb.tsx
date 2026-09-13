import { Children, Fragment, isValidElement, type ComponentProps, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The trail above a page title. Renders the `<nav aria-label="Breadcrumb">` and
 * an ordered list, and inserts the separators itself so no page has to remember
 * the chevron markup or hide it from assistive tech.
 */
export function Breadcrumb({ className, children, ...props }: ComponentProps<"nav">) {
  const crumbs = Children.toArray(children).filter(Boolean);
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("mb-6 min-w-0 text-sm text-ink-soft", className)}
      {...props}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-2">
        {crumbs.map((crumb, i) => (
          // Children.toArray stamps a stable key on every element it returns,
          // so the crumb's own key beats its position in the list.
          <Fragment key={isValidElement(crumb) ? crumb.key : i}>
            {i > 0 && (
              <li aria-hidden="true" className="flex shrink-0 items-center text-ink-soft/70">
                <ChevronRight className="h-4 w-4" />
              </li>
            )}
            <li className="flex min-w-0 items-center">{crumb}</li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** The page you're on. Always the last crumb. */
export function BreadcrumbCurrent({ children }: { children: ReactNode }) {
  return (
    <span aria-current="page" className="font-medium text-ink break-words">
      {children}
    </span>
  );
}

/**
 * Shared styling for an interactive crumb, whether it's a Link or a button.
 * Crumbs are inline text links, which WCAG 2.5.8 exempts from the 24px
 * minimum - but `py-2 -my-2` grows the hit area to ~36px at no cost to the
 * breadcrumb's layout height.
 */
export const crumbLinkClass =
  "-my-2 inline-flex min-w-0 items-center break-words rounded-sm py-2 hover:text-forest hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
