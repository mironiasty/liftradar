// Each country's page, by language: liftradar.eu/austria, /de/oesterreich, /fr/autriche… (README "Country pages").
// The pages link to them (countryPagePath in common.js); scripts/countries.mjs reads this file to build them, so it
// holds only this one value. A country without its line here has no page: add one with the country.
/** @type {Record<string, Record<string, string>>} */
const COUNTRY_SLUGS = {
  ad: { en: "andorra", de: "andorra", fr: "andorre", it: "andorra", pl: "andora" },
  at: { en: "austria", de: "oesterreich", fr: "autriche", it: "austria", pl: "austria" },
  bg: { en: "bulgaria", de: "bulgarien", fr: "bulgarie", it: "bulgaria", pl: "bulgaria" },
  ch: { en: "switzerland", de: "schweiz", fr: "suisse", it: "svizzera", pl: "szwajcaria" },
  cz: { en: "czechia", de: "tschechien", fr: "tchequie", it: "cechia", pl: "czechy" },
  de: { en: "germany", de: "deutschland", fr: "allemagne", it: "germania", pl: "niemcy" },
  es: { en: "spain", de: "spanien", fr: "espagne", it: "spagna", pl: "hiszpania" },
  fi: { en: "finland", de: "finnland", fr: "finlande", it: "finlandia", pl: "finlandia" },
  fr: { en: "france", de: "frankreich", fr: "france", it: "francia", pl: "francja" },
  it: { en: "italy", de: "italien", fr: "italie", it: "italia", pl: "wlochy" },
  no: { en: "norway", de: "norwegen", fr: "norvege", it: "norvegia", pl: "norwegia" },
  pl: { en: "poland", de: "polen", fr: "pologne", it: "polonia", pl: "polska" },
  si: { en: "slovenia", de: "slowenien", fr: "slovenie", it: "slovenia", pl: "slowenia" },
  sk: { en: "slovakia", de: "slowakei", fr: "slovaquie", it: "slovacchia", pl: "slowacja" },
};
