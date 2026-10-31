// sources.html: every URL the current data was built from (each report's
// `sources`), grouped by website, with how many resorts use it.

function show(index) {
  const resortsByUrl = new Map();
  for (const r of index.resorts) {
    for (const url of r.sources) {
      if (!resortsByUrl.has(url)) resortsByUrl.set(url, []);
      resortsByUrl.get(url).push(r.name);
    }
  }
  const byHost = new Map();
  for (const url of [...resortsByUrl.keys()].sort()) {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }

  const container = document.getElementById("urls");
  const hosts = [...byHost.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [host, urls] of hosts) {
    const list = el("ul", { class: "urls" }, ...urls.map((url) => {
      const names = resortsByUrl.get(url);
      const used = names.length === 1 ? names[0] : `${names.length} resorts`;
      return el("li", {}, el("a", { href: url, rel: "nofollow" }, url), el("span", { class: "muted" }, ` (${used})`));
    }));
    container.append(el("h3", {}, host, el("span", { class: "muted" }, ` (${urls.length})`)), list);
  }
  document.getElementById("status").textContent =
    `${resortsByUrl.size} pages on ${byHost.size} websites, used for ${index.resorts.length} resorts. ${updatedText(index)}.`;
}

loadIndex()
  .then(show)
  .catch((error) => {
    document.getElementById("status").textContent = `Could not load the data (${error.message})`;
  });
