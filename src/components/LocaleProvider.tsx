import { type ReactNode, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { localeForCurrency } from "@/lib/locale";
import { createLocaleFormatters, LocaleContext } from "@/lib/localeFormatters";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const viewer = useQuery(api.users.viewer);
  const locale = localeForCurrency(viewer?.defaultCurrency ?? DEFAULT_CURRENCY);
  const formatters = useMemo(() => createLocaleFormatters(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext.Provider value={formatters}>{children}</LocaleContext.Provider>;
}
