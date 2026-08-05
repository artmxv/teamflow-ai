import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { LANG_COOKIE, parseLang, type Lang } from "@/lib/i18n-locale";

/** SSR-readable preferred language from the `tf_lang` cookie. */
export const getPreferredLang = createServerFn({ method: "GET" }).handler((): Lang => {
  return parseLang(getCookie(LANG_COOKIE)) ?? "en";
});
