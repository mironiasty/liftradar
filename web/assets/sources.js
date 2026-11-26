// sources.html: every source the current data was built from (each report's `source_details`, which names each
// source by its website), grouped by what it gives, with how many resorts use it.

const siteOf = (/** @type {string} */ url) => new URL(url).hostname.replace(/^www\./, "");

/**
 * The sources of one kind, by website. A website listed by several pages (the resorts' pages at Fnugg, which its
 * terms ask to link) is one source, linked by its home page.
 * @param {Index} index
 * @param {"conditions" | "resort_info"} kind
 * @returns {{ ref: SourceRef, names: Set<string> }[]} most used first
 */
function sourcesOf(index, kind) {
  /** @type {Map<string, { ref: SourceRef, names: Set<string> }>} */
  const sites = new Map();
  for (const r of index.resorts) {
    for (const ref of r.source_details[kind]) {
      const site = siteOf(ref.url);
      const found = sites.get(site);
      if (!found) sites.set(site, { ref, names: new Set([r.name]) });
      else {
        if (found.ref.url !== ref.url) found.ref = { ...found.ref, url: `${new URL(ref.url).origin}/` };
        found.names.add(r.name);
      }
    }
  }
  return [...sites.values()].sort((a, b) => b.names.size - a.names.size || a.ref.url.localeCompare(b.ref.url));
}

/** @param {Index} index */
function show(index) {
  const container = document.getElementById("urls");
  const sites = new Set();
  /** @type {[string, "conditions" | "resort_info"][]} */
  const groups = [
    [t("Current conditions"), "conditions"],
    [t("Resort information"), "resort_info"],
  ];
  for (const [title, kind] of groups) {
    const found = sourcesOf(index, kind);
    if (!found.length) continue;
    container.append(
      el("h3", {}, title),
      el(
        "ul",
        { class: "urls" },
        ...found.map(({ ref, names }) =>
          sourceItem(ref, names.size === 1 ? [...names][0] : t("{n} resorts", { n: names.size })),
        ),
      ),
    );
    for (const { ref } of found) sites.add(siteOf(ref.url));
  }
  document.getElementById("status").textContent =
    `${t("{n} websites", { n: sites.size })} · ${t("{n} resorts", { n: index.resorts.length })} · ${updatedText(index)}.`;
}

loadIndex()
  .then(show)
  .catch((error) => {
    document.getElementById("status").textContent = t("Could not load the data ({message})", error);
  });
