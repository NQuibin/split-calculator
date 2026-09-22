export const DEFAULT_LOCALE = "en-US";

// A currency is not a locale (EUR, for example, spans many countries), so the
// app deliberately chooses one representative locale for each supported
// regional currency below. Unknown and shared currencies fall back to en-US
// rather than depending on the browser or operating system locale.
const CURRENCY_LOCALES: Readonly<Record<string, string>> = {
  AED: "ar-AE",
  ARS: "es-AR",
  AUD: "en-AU",
  BGN: "bg-BG",
  BRL: "pt-BR",
  CAD: "en-CA",
  CHF: "de-CH",
  CLP: "es-CL",
  CNY: "zh-CN",
  COP: "es-CO",
  CZK: "cs-CZ",
  DKK: "da-DK",
  EGP: "ar-EG",
  EUR: "de-DE",
  GBP: "en-GB",
  HKD: "zh-HK",
  HUF: "hu-HU",
  IDR: "id-ID",
  ILS: "he-IL",
  INR: "en-IN",
  ISK: "is-IS",
  JPY: "ja-JP",
  KRW: "ko-KR",
  MXN: "es-MX",
  MYR: "ms-MY",
  NOK: "nb-NO",
  NZD: "en-NZ",
  PHP: "en-PH",
  PLN: "pl-PL",
  RON: "ro-RO",
  SAR: "ar-SA",
  SEK: "sv-SE",
  SGD: "en-SG",
  THB: "th-TH",
  TRY: "tr-TR",
  TWD: "zh-TW",
  UAH: "uk-UA",
  USD: "en-US",
  VND: "vi-VN",
  ZAR: "en-ZA",
};

export function localeForCurrency(currency: string | undefined): string {
  return CURRENCY_LOCALES[currency?.toUpperCase() ?? ""] ?? DEFAULT_LOCALE;
}
