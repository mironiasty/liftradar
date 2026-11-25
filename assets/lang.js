// In the <head> of every page but 404.html, before anything is drawn. Coming to an English page from
// elsewhere, the visitor goes to the translation of it their browser prefers, unless they chose a language
// in the language menu (<a hreflang>), which is remembered. A link to /pl/ always stays there.

(() => {
  const LANGUAGES = ["en", "de", "fr", "it", "pl"];
  const KEY = "language";

  /** @type {string | null} */
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
  const wanted = chosen !== null && LANGUAGES.includes(chosen) ? chosen : fromThisSite ? null : browser;
  if (document.documentElement.lang === "en" && wanted && wanted !== "en") {
    // A page whose translations have addresses of their own (a country's: /austria, /de/oesterreich) names them
    // before this script; the others are the same address one folder down.
    const alternate = /** @type {HTMLLinkElement | null} */ (
      document.querySelector(`link[rel="alternate"][hreflang="${wanted}"]`)
    );
    const path = alternate ? new URL(alternate.href).pathname : `/${wanted}${location.pathname}`;
    location.replace(`${path}${location.search}${location.hash}`);
  }

  // A language in the menu is remembered, and keeps the resort, filters and order of the address.
  document.addEventListener("click", (event) => {
    const menu = document.querySelector(".lang-menu");
    const target = /** @type {any} */ (event.target);
    const link = target.closest?.("a[hreflang]");
    if (menu && (link || !menu.contains(target))) menu.open = false;
    if (!link) return;
    link.search = location.search;
    link.hash = location.hash;
    try {
      localStorage.setItem(KEY, link.hreflang);
    } catch {}
  });
  // The header's "Get the app" link shows only on a phone or tablet, for its own store (style.css .pill.app);
  // the footer links to both on a computer, and to its own there. iPadOS calls itself a Mac, with a touch screen.
  const ua = navigator.userAgent;
  const os = /Android/.test(ua)
    ? "android"
    : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? "ios"
      : null;
  if (os) document.documentElement.dataset.os = os;

  document.addEventListener("keydown", (event) => {
    const menu = document.querySelector(".lang-menu");
    if (event.key !== "Escape" || !menu?.open) return;
    menu.open = false;
    menu.querySelector("summary").focus();
  });
})();
