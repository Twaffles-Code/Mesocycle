# Meso — workout log

A phone-first web app for planning mesocycles and logging every set. Built to
work at the gym with no signal, install to your iPhone's Home Screen, and turn
into a native app later.

- **Mesos** start with 4 training weeks + a deload. Add weeks as you go; the
  deload always stays last and the app counts down to it.
- **Days** hold exercises in your usual order. Skip a day, add notes.
- **Exercises** hold sets. Each set has a rep target, RIR target and optional
  weight. Pick any exercise, log set by set, skip a set or a whole exercise.
- **Logging** pre-fills weight from your last set or last week, shows what you
  did last week, and suggests the next exercise when you finish one.
- **Set up** mesos in the app, or import a JSON config file.
- **Backups** of everything to a single file.

Your workouts are stored **on your phone only**. There's no account and no
server. See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for how it all
works, what changes if you host it yourself or on a hosting site, your login
options, and the path to a native app.

## Running it

Requires [Node.js](https://nodejs.org) 20.19+ or 22.12+.

```bash
npm install
npm run dev            # http://localhost:5173 on this computer
npm run dev -- --host  # also reachable from your phone on the same Wi-Fi
```

On your phone over Wi-Fi the address is plain `http://`, so offline mode and
Home Screen install won't work there — fine for trying things out. For real
use, host it somewhere with `https://` (next section).

## Checks

```bash
npm test               # unit tests (domain logic + storage)
npm run lint
npm run build          # type-checks, then builds to dist/
```

## Putting it online

`npm run build` produces a `dist/` folder of plain files. Upload it to any
static host — Netlify, Cloudflare Pages, Vercel, or GitHub Pages. The host
only serves the app; your workouts never leave your phone.

Then on your iPhone: open the address in Safari → Share → **Add to Home
Screen**. Do this *before* you start logging: the Home Screen app keeps its
own storage, separate from Safari.

## Config files

See [`examples/meso-config.example.json`](examples/meso-config.example.json)
and the [config section](docs/ARCHITECTURE.md#6-config-files) of the
architecture doc.
