import { createContext, useContext } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import {
  currency as formatCurrency,
  formatExpenseDate as formatDate,
  formatExpenseDateShort as formatDateShort,
} from "@/lib/format";
import { DEFAULT_LOCALE } from "@/lib/locale";

export interface LocaleFormatters {
  locale: string;
  currency: (amount: number, currency?: string) => string;
  formatExpenseDate: (iso: string | undefined) => string | undefined;
  formatExpenseDateShort: (iso: string | undefined) => string | undefined;
}

export function createLocaleFormatters(locale: string): LocaleFormatters {
  return {
    locale,
    currency: (amount, currency = DEFAULT_CURRENCY) => formatCurrency(amount, currency, locale),
    formatExpenseDate: (iso) => formatDate(iso, locale),
    formatExpenseDateShort: (iso) => formatDateShort(iso, locale),
  };
}

export const LocaleContext = createContext<LocaleFormatters>(
  createLocaleFormatters(DEFAULT_LOCALE),
);

export function useLocaleFormatters(): LocaleFormatters {
  return useContext(LocaleContext);
}
