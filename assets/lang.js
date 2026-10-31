// In the <head> of every page but 404.html, before anything is drawn. Coming to an English page from
// elsewhere, the visitor goes to the translation of it their browser prefers, unless they chose a language
// in the language menu (<a hreflang>), which is remembered. A link to /pl/ always stays there.

(() => {
  const LANGUAGES = ["en", "de", "fr", "it", "pl"];
  const KEY = "language";

  let chosen = null;
  try {
    chosen = localStorage.getItem(KEY);
  } catch {}
  // First of the browser's languages that the site has: en-GB before pl stays English.
  const browser = navigator.languages
    .map((code) => code.slice(0, 2).toLowerCase())
    .find((code) => LANGUAGES.includes(code));
  // Without storage, this still lets the menu go to English.
  const fromThisSite = document.referrer.startsWith(`${location.origin}/`);
  const wanted = LANGUAGES.includes(chosen) ? chosen : fromThisSite ? null : browser;
  if (document.documentElement.lang === "en" && wanted && wanted !== "en")
    location.replace(`/${wanted}${location.pathname}${location.search}${location.hash}`);

  // A language in the menu is remembered, and keeps the resort, filters and order of the address.
  document.addEventListener("click", (event) => {
    const menu = document.querySelector(".lang-menu");
    const link = event.target.closest?.("a[hreflang]");
    if (menu && (link || !menu.contains(event.target))) menu.open = false;
    if (!link) return;
    link.search = location.search;
    link.hash = location.hash;
    try {
      localStorage.setItem(KEY, link.hreflang);
    } catch {}
  });
  document.addEventListener("keydown", (event) => {
    const menu = document.querySelector(".lang-menu");
    if (event.key !== "Escape" || !menu?.open) return;
    menu.open = false;
    menu.querySelector("summary").focus();
  });
})();
