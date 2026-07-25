"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FlagIconProps {
  countryCode?: string;
  locale?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: "US",
  pt: "BR", // Portuguese - default to Brazil
  es: "ES", // Spanish - default to Spain
  fr: "FR", // French
  de: "DE", // German
  it: "IT", // Italian
  ja: "JP", // Japanese
  ko: "KR", // Korean
  zh: "CN", // Chinese - default to China
  ru: "RU", // Russian
  ar: "SA", // Arabic - default to Saudi Arabia
  hi: "IN", // Hindi - India
  nl: "NL", // Dutch
  sv: "SE", // Swedish
  no: "NO", // Norwegian
  da: "DK", // Danish
  fi: "FI", // Finnish
  pl: "PL", // Polish
  tr: "TR", // Turkish
  th: "TH", // Thai
  vi: "VN", // Vietnamese
  id: "ID", // Indonesian
  ms: "MY", // Malay - Malaysia
  tl: "PH", // Filipino/Tagalog
  uk: "UA", // Ukrainian
  cs: "CZ", // Czech
  sk: "SK", // Slovak
  hu: "HU", // Hungarian
  ro: "RO", // Romanian
  bg: "BG", // Bulgarian
  hr: "HR", // Croatian
  sr: "RS", // Serbian
  sl: "SI", // Slovenian
  et: "EE", // Estonian
  lv: "LV", // Latvian
  lt: "LT", // Lithuanian
  mt: "MT", // Maltese
  ga: "IE", // Irish Gaelic
  cy: "GB", // Welsh
  is: "IS", // Icelandic
  ca: "ES", // Catalan - Spain
  eu: "ES", // Basque - Spain
  gl: "ES", // Galician - Spain
  he: "IL", // Hebrew
  fa: "IR", // Persian/Farsi
  ur: "PK", // Urdu
  bn: "BD", // Bengali
  ta: "IN", // Tamil
  te: "IN", // Telugu
  ml: "IN", // Malayalam
  kn: "IN", // Kannada
  gu: "IN", // Gujarati
  or: "IN", // Odia
  pa: "IN", // Punjabi
  as: "IN", // Assamese
  ne: "NP", // Nepali
  si: "LK", // Sinhala
  my: "MM", // Burmese
  km: "KH", // Khmer
  lo: "LA", // Lao
  ka: "GE", // Georgian
  hy: "AM", // Armenian
  az: "AZ", // Azerbaijani
  kk: "KZ", // Kazakh
  ky: "KG", // Kyrgyz
  uz: "UZ", // Uzbek
  tg: "TJ", // Tajik
  mn: "MN", // Mongolian
  be: "BY", // Belarusian
  mk: "MK", // Macedonian
  sq: "AL", // Albanian
  bs: "BA", // Bosnian
  me: "ME", // Montenegrin
  lb: "LU", // Luxembourgish
  rm: "CH", // Romansh - Switzerland
  fur: "IT", // Friulian - Italy
  sc: "IT", // Sardinian - Italy
  co: "FR", // Corsican - France
  br: "FR", // Breton - France
  oc: "FR", // Occitan - France
  an: "ES", // Aragonese - Spain
  ast: "ES", // Asturian - Spain
  ext: "ES", // Extremaduran - Spain
  mwl: "PT", // Mirandese - Portugal
  nap: "IT", // Neapolitan - Italy
  scn: "IT", // Sicilian - Italy
  vec: "IT", // Venetian - Italy
  lij: "IT", // Ligurian - Italy
  pms: "IT", // Piedmontese - Italy
  lmo: "IT", // Lombard - Italy
  egl: "IT", // Emilian-Romagnol - Italy
};

const LOCALE_TO_COUNTRY: Record<string, string> = {
  "en-US": "US",
  "en-GB": "GB",
  "en-CA": "CA",
  "en-AU": "AU",
  "en-NZ": "NZ",
  "en-IE": "IE",
  "en-ZA": "ZA",
  "en-IN": "IN",
  "en-SG": "SG",
  "en-PH": "PH",

  "pt-BR": "BR",
  "pt-PT": "PT",
  "pt-AO": "AO",
  "pt-MZ": "MZ",

  "es-ES": "ES",
  "es-MX": "MX",
  "es-AR": "AR",
  "es-CO": "CO",
  "es-VE": "VE",
  "es-PE": "PE",
  "es-CL": "CL",
  "es-EC": "EC",
  "es-BO": "BO",
  "es-PY": "PY",
  "es-UY": "UY",
  "es-CR": "CR",
  "es-PA": "PA",
  "es-GT": "GT",
  "es-HN": "HN",
  "es-NI": "NI",
  "es-SV": "SV",
  "es-DO": "DO",
  "es-CU": "CU",
  "es-PR": "PR",

  "fr-FR": "FR",
  "fr-CA": "CA",
  "fr-BE": "BE",
  "fr-CH": "CH",
  "fr-LU": "LU",
  "fr-MC": "MC",

  "de-DE": "DE",
  "de-AT": "AT",
  "de-CH": "CH",
  "de-LU": "LU",
  "de-LI": "LI",

  "it-IT": "IT",
  "it-CH": "CH",
  "it-SM": "SM",
  "it-VA": "VA",

  "zh-CN": "CN",
  "zh-TW": "TW",
  "zh-HK": "HK",
  "zh-SG": "SG",
  "zh-MO": "MO",

  "ar-SA": "SA",
  "ar-EG": "EG",
  "ar-AE": "AE",
  "ar-QA": "QA",
  "ar-KW": "KW",
  "ar-BH": "BH",
  "ar-OM": "OM",
  "ar-JO": "JO",
  "ar-LB": "LB",
  "ar-SY": "SY",
  "ar-IQ": "IQ",
  "ar-YE": "YE",
  "ar-PS": "PS",
  "ar-MA": "MA",
  "ar-DZ": "DZ",
  "ar-TN": "TN",
  "ar-LY": "LY",
  "ar-SD": "SD",

  "nl-NL": "NL",
  "nl-BE": "BE",
  "nl-SR": "SR",

  "sv-SE": "SE",
  "sv-FI": "FI",
  "no-NO": "NO",
  "da-DK": "DK",
  "fi-FI": "FI",
  "is-IS": "IS",
  "hu-HU": "HU",
  "pl-PL": "PL",
  "cs-CZ": "CZ",
  "sk-SK": "SK",
  "sl-SI": "SI",
  "et-EE": "EE",
  "lv-LV": "LV",
  "lt-LT": "LT",
  "ru-RU": "RU",
  "uk-UA": "UA",
  "be-BY": "BY",
  "bg-BG": "BG",
  "mk-MK": "MK",
  "sr-RS": "RS",
  "hr-HR": "HR",
  "bs-BA": "BA",
  "mt-MT": "MT",
  "sq-AL": "AL",
  "ro-RO": "RO",
  "tr-TR": "TR",
  "el-GR": "GR",
  "he-IL": "IL",
  "fa-IR": "IR",
  "hi-IN": "IN",
  "bn-BD": "BD",
  "ur-PK": "PK",
  "th-TH": "TH",
  "vi-VN": "VN",
  "id-ID": "ID",
  "ms-MY": "MY",
  "tl-PH": "PH",
  "ja-JP": "JP",
  "ko-KR": "KR",
  "ka-GE": "GE",
  "hy-AM": "AM",
  "az-AZ": "AZ",
  "kk-KZ": "KZ",
  "ky-KG": "KG",
  "uz-UZ": "UZ",
  "tg-TJ": "TJ",
  "mn-MN": "MN",
  "ne-NP": "NP",
  "si-LK": "LK",
  "my-MM": "MM",
  "km-KH": "KH",
  "lo-LA": "LA",
};

const countryCodeToFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "";

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

const getCountryName = (countryCode: string): string => {
  const countryNames: Record<string, string> = {
    US: "United States",
    GB: "United Kingdom",
    BR: "Brazil",
    PT: "Portugal",
    ES: "Spain",
    FR: "France",
    DE: "Germany",
    IT: "Italy",
    JP: "Japan",
    KR: "South Korea",
    CN: "China",
    TW: "Taiwan",
    RU: "Russia",
    IN: "India",
    MX: "Mexico",
    CA: "Canada",
    AU: "Australia",
    NZ: "New Zealand",
    ZA: "South Africa",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PE: "Peru",
    VE: "Venezuela",
    NL: "Netherlands",
    BE: "Belgium",
    CH: "Switzerland",
    AT: "Austria",
    SE: "Sweden",
    NO: "Norway",
    DK: "Denmark",
    FI: "Finland",
    PL: "Poland",
    CZ: "Czech Republic",
    HU: "Hungary",
    TR: "Turkey",
    GR: "Greece",
    IL: "Israel",
    SA: "Saudi Arabia",
    AE: "United Arab Emirates",
    EG: "Egypt",
    TH: "Thailand",
    VN: "Vietnam",
    ID: "Indonesia",
    MY: "Malaysia",
    SG: "Singapore",
    PH: "Philippines",
    HK: "Hong Kong",
    IE: "Ireland",
    LU: "Luxembourg",
    MC: "Monaco",
    LI: "Liechtenstein",
    SM: "San Marino",
    VA: "Vatican City",
    MO: "Macau",
    QA: "Qatar",
    KW: "Kuwait",
    BH: "Bahrain",
    OM: "Oman",
    JO: "Jordan",
    LB: "Lebanon",
    SY: "Syria",
    IQ: "Iraq",
    YE: "Yemen",
    PS: "Palestine",
    MA: "Morocco",
    DZ: "Algeria",
    TN: "Tunisia",
    LY: "Libya",
    SD: "Sudan",
    SR: "Suriname",
    AO: "Angola",
    MZ: "Mozambique",
    CR: "Costa Rica",
    PA: "Panama",
    GT: "Guatemala",
    HN: "Honduras",
    NI: "Nicaragua",
    SV: "El Salvador",
    DO: "Dominican Republic",
    CU: "Cuba",
    PR: "Puerto Rico",
    BO: "Bolivia",
    PY: "Paraguay",
    UY: "Uruguay",
    EC: "Ecuador",
  };

  return countryNames[countryCode] || countryCode;
};

const getCountryCode = (language?: string, locale?: string): string => {
  if (locale) {
    const localeUpper = locale.toUpperCase();
    if (LOCALE_TO_COUNTRY[locale]) {
      return LOCALE_TO_COUNTRY[locale];
    }

    const parts = locale.split(/[-_]/);
    if (parts.length === 2 && parts[1].length === 2) {
      return parts[1].toUpperCase();
    }
  }

  if (language) {
    return LANGUAGE_TO_COUNTRY[language.toLowerCase()] || "XX";
  }

  return "XX";
};

const FlagIcon: React.FC<FlagIconProps> = ({
  countryCode,
  locale,
  size = "md",
  className,
}) => {
  let finalCountryCode = countryCode;

  if (!finalCountryCode && locale) {
    const language = locale.split(/[-_]/)[0];
    finalCountryCode = getCountryCode(language, locale);
  }

  if (!finalCountryCode) {
    finalCountryCode = "XX";
  }

  const flag = countryCodeToFlag(finalCountryCode);
  const countryName = getCountryName(finalCountryCode);

  const sizeClasses = {
    sm: "text-base", // 16px
    md: "text-xl", // 20px
    lg: "text-2xl", // 24px
  };

  return (
    <span
      className={cn(
        "inline-block font-emoji select-none",
        sizeClasses[size],
        className,
      )}
      title={countryName}
      aria-label={`Flag of ${countryName}`}
      role="img"
    >
      {flag}
    </span>
  );
};

export default FlagIcon;
