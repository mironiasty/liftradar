// sources.html: every URL the current data was built from (each report's
// `source_details`), grouped by what it gives and by website, with how many resorts use it.

/**
 * @param {Index} index
 * @param {"conditions" | "resort_info"} kind
 * @returns {Map<string, { ref: SourceRef, names: string[] }>} by URL
 */
function pagesOf(index, kind) {
  const pages = new Map();
  for (const r of index.resorts) {
    for (const ref of sourceDetails(r)[kind]) {
      if (!pages.has(ref.url)) pages.set(ref.url, { ref, names: [] });
      pages.get(ref.url)?.names.push(r.name);
    }
  }
  return pages;
}

/** @param {Map<string, { ref: SourceRef, names: string[] }>} pages */
function showPages(container, pages) {
  const byHost = new Map();
  for (const url of [...pages.keys()].sort()) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }
  const hosts = [...byHost.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [host, urls] of hosts) {
    const list = el(
      "ul",
      { class: "urls" },
      ...urls.map((url) => {
        const { ref, names } = /** @type {{ ref: SourceRef, names: string[] }} */ (pages.get(url));
        return sourceItem(ref, names.length === 1 ? names[0] : t("{n} resorts", { n: names.length }));
      }),
    );
    container.append(el("h4", {}, host, el("span", { class: "muted" }, ` (${urls.length})`)), list);
  }
  return byHost.size;
}

/** @param {Index} index */
function show(index) {
  const container = document.getElementById("urls");
  let pages = 0;
  const hosts = new Set();
  /** @type {[string, "conditions" | "resort_info"][]} */
  const groups = [
    [t("Current conditions"), "conditions"],
    [t("Resort information"), "resort_info"],
  ];
  for (const [title, kind] of groups) {
    const found = pagesOf(index, kind);
    if (!found.size) continue;
    container.append(el("h3", {}, title));
    showPages(container, found);
    pages += found.size;
    for (const url of found.keys()) hosts.add(new URL(url).hostname.replace(/^www\./, ""));
  }
  document.getElementById("status").textContent =
    `${t("{pages} pages on {sites} websites, used for {n} resorts.", { pages, sites: hosts.size, n: index.resorts.length })} ${updatedText(index)}.`;
}

loadIndex()
  .then(show)
  .catch((error) => {
    document.getElementById("status").textContent = t("Could not load the data ({message})", error);
  });
