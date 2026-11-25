# Fetching from the Raspberry Pi at home, GitHub as the fallback

Plan from 22 November 2026. Nothing is built yet.

## Why

Some sources refuse GitHub Actions' servers but answer a home connection:

| Source | Resorts | From GitHub |
| --- | --- | --- |
| lovevda.it (Valle d'Aosta bulletin) | 13: Breuil-Cervinia, Courmayeur, La Thuile, Pila, Monterosa Ski, Torgnon, Champorcher, Crevacol, Rhêmes-Notre-Dame, Brusson, Chamois, Cogne, Gressoney-Saint-Jean | ConnectTimeout since the 21.11 morning run (last good run 20.11 15:48 UTC); 200 in 0.35 s from home |
| ski.salla.fi | Salla | 403 |
| golte.si | Golte | 403 |
| baqueira.es | Baqueira-Beret | 403, listed with its size only |
| zieleniec.pl | Zieleniec | 403, listed with its size only |
| Soriška planina | Soriška planina | 403 |

Pretending to be a browser is against the project's rules: the Pi sends the same User-Agent as GitHub,
`liftradar-fetcher/0.1 (+https://liftradar.eu)`. Only the address it comes from changes.

## The chosen design

The Pi (Home Assistant OS, no public IP: outbound connections only) runs the whole fetch first; GitHub
runs it only when the Pi didn't publish.

1. **08:40 and 13:40 Vienna time, on the Pi** (a local Home Assistant add-on with its own schedule,
   `TZ=Europe/Vienna`):
   - `git pull` liftradar-fetcher's main (the latest code),
   - check out `archive/` and `logs/` from the `data` branch, as `fetch.yml` does,
   - run the tests, `liftradar-fetcher --out public --previous previous` and the schema validation,
   - `git push` the result to the `data` branch, with a commit title such as
     "Update snow conditions (home)". The push also rebuilds the site, as `deploy.yml` goes with the data.
2. **08:50 and 13:50, the trigger Worker** (`deploy/trigger` in liftradar-fetcher, which today
   dispatches `fetch.yml` at 08:40 and 13:40): reads the latest commit on `data` through the GitHub API.
   Newer than this slot's 08:40 / 13:40? Done. Otherwise it dispatches `fetch.yml` on GitHub as today
   (with its existing retries).

The check lives in the Worker rather than in a GitHub run, so a slot the Pi covered costs no Actions run.

## Rules

- **One run script for both.** Move `fetch.yml`'s steps into a script in liftradar-fetcher (e.g.
  `scripts/run.sh`) that both the workflow and the Pi call, so the two never drift apart.
- **The Pi never publishes late.** If its run ends after HH:49 (slow, or started late after a reboot), it
  doesn't push: the GitHub run may already be under way, and a push in between would leave two runs
  publishing, the second without the first's archive row.
- **Keys of its own on the Pi**, revocable without touching GitHub's:
  - a read-only deploy key on liftradar-fetcher (pull the code),
  - a write deploy key on liftradar (push `data`).
- **Notify on failure**: the add-on reports a failed run to Home Assistant, which sends a notification.

## What stays as it is

- When the Pi is down, the GitHub run comes about 10 minutes later and can't read the sources above:
  those resorts keep their last status, and turn `no_report` after 14 days without a report, as today.
- A Pi run that succeeds but loses some sources (flaky home connection) doesn't call GitHub in: those
  resorts keep their last status.
- All the run's requests (hundreds, twice a day) come from the home address. A source with limits
  (panoraama.com: 403 after about ten requests; Open Data Hub: 429) would throttle the home connection,
  not GitHub's.
- Where a site forbids automated reading outright, ask its operator first (as with Toubiz).

## Variants considered

- **The Pi caches only the blocked pages**: it fetches the listed URLs about 15 minutes before each run and
  uploads them to the Worker (KV, with a token); `Fetcher._get_text` in `fetcher.py` takes a fresh copy
  (at most ~3 h old) for those URLs, else fetches directly. Keeps all other traffic on GitHub, but needs a
  list of URLs, storage in the Worker and fetcher code.
- **A self-hosted GitHub runner on the Pi**, with `fetch.yml` choosing the machine: the runner keeps an
  outbound connection to GitHub, so no public IP is needed. A job for an offline runner waits in the queue
  (up to 24 h) without failing, so the Worker would have to cancel it after ~10 minutes and dispatch the
  same workflow on `ubuntu-latest`. More moving parts than the chosen design.
