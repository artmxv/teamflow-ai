export type Lang = "en" | "ru";

export const LANG_COOKIE = "tf_lang";
export const LANG_STORAGE_KEY = "tf_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseLang(value: string | null | undefined): Lang | null {
  return value === "en" || value === "ru" ? value : null;
}

/** Client-only: write preference to cookie + localStorage. */
export function persistLang(lang: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Blocking head script: migrate localStorage → cookie and set <html lang>
 * before React paints. Mirrors THEME_INIT_SCRIPT pattern.
 */
export const LANG_INIT_SCRIPT = `
(function () {
  try {
    var root = document.documentElement;
    var match = document.cookie.match(/(?:^|; )tf_lang=(ru|en)/);
    var lang = match ? match[1] : null;
    if (!lang) {
      var stored = null;
      try { stored = localStorage.getItem("tf_lang"); } catch (_) {}
      if (stored === "ru" || stored === "en") {
        lang = stored;
        document.cookie = "tf_lang=" + lang + "; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax";
      }
    }
    if (lang === "ru" || lang === "en") {
      root.lang = lang;
    }
  } catch (_) {}
})();
`.trim();
