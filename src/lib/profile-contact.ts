export const PHONE_COUNTRY_OPTIONS = [
  { id: "RU", flag: "🇷🇺", dial: "+7", labelEn: "Russia", labelRu: "Россия" },
  { id: "PL", flag: "🇵🇱", dial: "+48", labelEn: "Poland", labelRu: "Польша" },
  { id: "DE", flag: "🇩🇪", dial: "+49", labelEn: "Germany", labelRu: "Германия" },
  { id: "FR", flag: "🇫🇷", dial: "+33", labelEn: "France", labelRu: "Франция" },
  { id: "ES", flag: "🇪🇸", dial: "+34", labelEn: "Spain", labelRu: "Испания" },
  { id: "IT", flag: "🇮🇹", dial: "+39", labelEn: "Italy", labelRu: "Италия" },
  { id: "GB", flag: "🇬🇧", dial: "+44", labelEn: "United Kingdom", labelRu: "Великобритания" },
  { id: "US", flag: "🇺🇸", dial: "+1", labelEn: "United States", labelRu: "США" },
  { id: "AE", flag: "🇦🇪", dial: "+971", labelEn: "UAE", labelRu: "ОАЭ" },
  { id: "TR", flag: "🇹🇷", dial: "+90", labelEn: "Turkey", labelRu: "Турция" },
  { id: "OTHER", flag: "", dial: "", labelEn: "Other", labelRu: "Другая" },
] as const;

export type PhoneCountryId = (typeof PHONE_COUNTRY_OPTIONS)[number]["id"];

export const LOCATION_COUNTRY_OPTIONS = [
  { value: "Russia", flag: "🇷🇺", labelEn: "Russia", labelRu: "Россия" },
  { value: "Poland", flag: "🇵🇱", labelEn: "Poland", labelRu: "Польша" },
  { value: "Germany", flag: "🇩🇪", labelEn: "Germany", labelRu: "Германия" },
  { value: "France", flag: "🇫🇷", labelEn: "France", labelRu: "Франция" },
  { value: "Spain", flag: "🇪🇸", labelEn: "Spain", labelRu: "Испания" },
  { value: "Italy", flag: "🇮🇹", labelEn: "Italy", labelRu: "Италия" },
  { value: "United Kingdom", flag: "🇬🇧", labelEn: "United Kingdom", labelRu: "Великобритания" },
  { value: "United States", flag: "🇺🇸", labelEn: "United States", labelRu: "США" },
  { value: "UAE", flag: "🇦🇪", labelEn: "UAE", labelRu: "ОАЭ" },
  { value: "Turkey", flag: "🇹🇷", labelEn: "Turkey", labelRu: "Турция" },
  { value: "OTHER", flag: "", labelEn: "Other", labelRu: "Другая" },
] as const;

export type LocationCountryValue = (typeof LOCATION_COUNTRY_OPTIONS)[number]["value"];

/** Internal form value when user has not set a country yet */
export const LOCATION_UNSET = "__unset__" as const;

export type LocationFormCountry = LocationCountryValue | typeof LOCATION_UNSET;

const PHONE_BY_DIAL = [...PHONE_COUNTRY_OPTIONS]
  .filter((c) => c.dial)
  .sort((a, b) => b.dial.length - a.dial.length);

export function parsePhone(stored: string): { countryId: PhoneCountryId; local: string } {
  const trimmed = stored.trim();
  if (!trimmed) {
    return { countryId: "RU", local: "" };
  }

  const compact = trimmed.replace(/\s+/g, "");
  for (const option of PHONE_BY_DIAL) {
    const dialCompact = option.dial.replace(/\s+/g, "");
    if (compact.startsWith(dialCompact)) {
      const local = compact.slice(dialCompact.length).replace(/^[\s-]+/, "");
      return { countryId: option.id, local };
    }
    if (trimmed.startsWith(option.dial)) {
      const local = trimmed.slice(option.dial.length).replace(/^[\s-]+/, "");
      return { countryId: option.id, local };
    }
  }

  return { countryId: "OTHER", local: trimmed };
}

export function formatPhone(countryId: PhoneCountryId, local: string): string {
  const trimmedLocal = local.trim();
  if (!trimmedLocal) {
    return "";
  }
  if (countryId === "OTHER") {
    return trimmedLocal;
  }
  const option = PHONE_COUNTRY_OPTIONS.find((c) => c.id === countryId);
  if (!option?.dial) {
    return trimmedLocal;
  }
  const digits = trimmedLocal.replace(/\s+/g, "");
  return `${option.dial} ${digits}`;
}

export function parseLocation(stored: string): {
  country: LocationFormCountry;
  other: string;
} {
  const trimmed = stored.trim();
  if (!trimmed) {
    return { country: LOCATION_UNSET, other: "" };
  }

  for (const option of LOCATION_COUNTRY_OPTIONS) {
    if (option.value === "OTHER") {
      continue;
    }
    if (trimmed === option.value || trimmed === option.labelEn || trimmed === option.labelRu) {
      return { country: option.value, other: "" };
    }
  }

  return { country: "OTHER", other: trimmed };
}

export function formatLocation(country: LocationFormCountry, other: string): string {
  if (country === LOCATION_UNSET) {
    return "";
  }
  if (country === "OTHER") {
    return other.trim();
  }
  return country;
}

/** Closed select trigger: flag + dial only (no country name). */
export function phoneCountryTriggerLabel(id: PhoneCountryId, lang: "en" | "ru"): string {
  const option = PHONE_COUNTRY_OPTIONS.find((c) => c.id === id);
  if (!option) {
    return id;
  }
  if (id === "OTHER") {
    return lang === "ru" ? option.labelRu : option.labelEn;
  }
  return `${option.flag} ${option.dial}`.trim();
}

/** Dropdown option: flag + dial + localized country name. */
export function phoneCountryLabel(id: PhoneCountryId, lang: "en" | "ru"): string {
  const option = PHONE_COUNTRY_OPTIONS.find((c) => c.id === id);
  if (!option) {
    return id;
  }
  if (id === "OTHER") {
    return lang === "ru" ? option.labelRu : option.labelEn;
  }
  const name = lang === "ru" ? option.labelRu : option.labelEn;
  return `${option.flag} ${option.dial} ${name}`.trim();
}

export function locationCountryLabel(value: LocationFormCountry, lang: "en" | "ru"): string {
  if (value === LOCATION_UNSET) {
    return "—";
  }
  const option = LOCATION_COUNTRY_OPTIONS.find((c) => c.value === value);
  if (!option) {
    return value;
  }
  const name = lang === "ru" ? option.labelRu : option.labelEn;
  if (value === "OTHER") {
    return lang === "ru" ? option.labelRu : option.labelEn;
  }
  return `${option.flag} ${name}`;
}

/** Display stored location string with localized country names when recognized */
export function displayLocationFromStored(
  stored: string | null | undefined,
  lang: "en" | "ru",
): string {
  const trimmed = (stored ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const parsed = parseLocation(trimmed);
  if (parsed.country !== LOCATION_UNSET && parsed.country !== "OTHER") {
    const option = LOCATION_COUNTRY_OPTIONS.find((c) => c.value === parsed.country);
    if (option) {
      return locationCountryLabel(parsed.country, lang);
    }
  }

  if (parsed.country === "OTHER" && parsed.other.trim()) {
    return parsed.other.trim();
  }

  return trimmed;
}

export function formatJoinedDate(iso: string | null | undefined, lang: "en" | "ru"): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (lang === "ru") {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
