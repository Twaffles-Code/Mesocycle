# How the Meso app works

This explains the app from the ground up: what the pieces are, where your
workouts are stored, what changes if you host it yourself or on a hosting
site, what your login options are, and how it becomes a native iPhone app
later. No prior knowledge assumed.

---

## 1. The big picture: four layers

The app is split into layers. Each layer has one job and only talks to the
layer next to it. Think of a restaurant:

| Restaurant | In this app | Folder | Its one job |
|---|---|---|---|
| The recipes | **Domain** | `src/domain/` | The rules: what a meso is, how to add a week, how to log a set. Plain TypeScript — no screens, no storage. |
| The pantry | **Storage** | `src/storage/` | Keeping data safe between visits. |
| The head waiter | **State** | `src/state/` | Holds the data while the app is open, applies changes, asks Storage to save them. |
| The dining room | **Screens** | `src/screens/`, `src/ui/` | What you see and tap. |

The rule that makes this work: **a screen never saves anything itself, and
the domain never knows a screen exists.** When you tap *Log set*:

```
ExerciseScreen  ──"log 75 × 11 @ RIR 2"──►  MesoStore.update(...)
                                               │
                                               ├─► logSet(meso, …)        (domain: returns a NEW meso)
                                               ├─► show it on screen now
                                               └─► repository.save(meso)  (storage: write to disk)
```

Why bother? Because each piece can be swapped without touching the others.
The storage layer is the one you'll most likely swap — from "this phone" to
"a server" — and when you do, not a single screen changes.

### Pure functions

Everything in `src/domain/` is a *pure function*: give it a meso, it hands
back a **new** meso and never changes the one you gave it. That sounds fussy,
but it buys three things:

- **Testing is easy.** No browser, no database — just "given this, expect
  that." There are 56 of these tests in `src/**/*.test.ts`.
- **React knows what changed.** It compares old and new; different object
  means re-draw.
- **Nothing gets half-saved.** A change either produces a whole new meso or
  throws an error and leaves the old one alone.

---

## 2. The shape of your data

```
Meso  "Meso 5 - Mass 2"   (units: lb)
 ├─ Week 1
 │   ├─ Day "Upper 1"   notes: "Shoulder tight"   skipped: no
 │   │   ├─ Exercise "Incline DB Bench"   skipped: no
 │   │   │   ├─ Set 1   target 8-12 @ RIR 1-2, 75 lb   →  did 75 × 11 @ 2   ✓ done
 │   │   │   ├─ Set 2   target 8-12 @ RIR 1-2, 75 lb   →  did 72.5 × 9      ✓ done
 │   │   │   └─ Set 3   target 8-12 @ RIR 1-2, 75 lb   →  —                 skipped
 │   │   └─ Exercise "DB Row" …
 │   └─ Day "Lower 1" …
 ├─ Week 2 … Week 4
 └─ Deload            (always last; the app labels it and counts down to it)
```

The definitions are in `src/domain/types.ts`. A few decisions worth knowing:

**Every set holds both the plan and what happened.** `targetReps`,
`targetRir`, `targetWeight` are the plan; `reps`, `rir`, `weight` are what you
did. One record, so they can never get out of step.

**Targets are text, results are numbers.** Coaches write `8-12` and `1-2`,
which aren't numbers. What you actually did is always one number.

**A set is `pending`, `done`, or `skipped`.** Skipping is a deliberate
choice, so it's recorded — not just left blank.

**Every week is a full copy of its days.** Week 3 doesn't point back at a
template; it owns its own exercises. That's what lets you swap an exercise
from week 3 onwards without touching weeks 1–2.

**New mesos start as 4 training weeks + a deload.** *Add week* inserts a
week just *before* the deload, copying the latest training week's exercises
(with no results). The deload can't be deleted, so it's always there.

**Days and exercises are found by id, not position.** Reordering exercises
can never attach your results to the wrong one.

### Editing a meso that's already running

*Edit day* asks whether the change applies to **this week only** or **this
week and after**:

- In the week you're editing, exercises keep their logged sets even if you
  rename them or change targets.
- In later weeks, exercises are matched by *name*. Swap "DB Lateral Raise"
  for "Cable Lateral Raise" and the later weeks get the new exercise, fresh.
- Earlier weeks are never touched. Your history stays exactly as it happened.
- If an edit would delete sets you've already logged, the app tells you how
  many and asks first.

---

## 3. Where your workouts are stored

### Right now: on your phone, in the browser

The app saves into **IndexedDB**, a real database built into every browser.
It lives on the phone, works with no signal, and survives closing the app.
Each meso is stored as one record holding its whole tree of weeks → days →
exercises → sets (a "document"). A whole meso is a few hundred sets: tiny.

The code is `src/storage/indexedDb.ts`. It's ~50 lines, and it's the only
file that knows IndexedDB exists.

**What that means for you, honestly:**

| ✅ Good | ⚠️ Watch out |
|---|---|
| Works in a basement gym with no signal | Lives on **one** phone. Lose the phone, lose the data — unless you have a backup |
| Instant — no network round-trips | Clearing Safari's website data deletes it |
| Private — nothing leaves your phone | Private-browsing tabs can't keep it at all |
| Free — no server to pay for | Safari tabs that go unused for 7 days can have their data cleared. **Home Screen apps are exempt.** |

That's why the app:

1. **Asks the browser for "persistent" storage** on start-up
   (`src/storage/persistence.ts`) — a request not to clear it when space runs
   low. A request, not a guarantee.
2. **Tells you to add it to your Home Screen.** On iPhone, that makes it
   full-screen, offline, and exempt from the 7-day rule. One catch: **the Home
   Screen app has its own storage, separate from Safari tabs.** Install it
   first, *then* start logging. (Already logged in Safari? Save a backup,
   install, restore.)
3. **Has backups** (Data & backup screen). One JSON file with every meso and
   every set. Save it to iCloud Drive or email it to yourself. The home
   screen nags you after 14 days without one.

### Hosting the app: two very different meanings

This is the bit that trips people up. "Hosting" can mean hosting the
**app** (the HTML, JavaScript and CSS files) or hosting the **data** (your
workouts). This app, as built, only needs the first. Your workouts stay on
your phone either way.

```
Hosting the APP only (what this app needs)        Hosting the DATA too (a future step)

   [host]  ── app files ──►  [phone]                 [host]  ── app files ──►  [phone]
                              └─ workouts              [server + database] ◄─ workouts ─► [phone]
                                 (IndexedDB)                                               [laptop]
```

#### Option A — Host it on your own computer ("locally")

You run the app on your laptop (`npm run dev -- --host`) and open
`http://192.168.x.x:5173` on your phone over home Wi-Fi.

- **Where your workouts are:** still on the phone. The laptop only hands
  over the app's files.
- **The big catch: no HTTPS.** Browsers only allow installing to the Home
  Screen, offline mode and persistent storage on *secure* pages: `https://`
  or `localhost`. A home-network `http://` address is neither. So you get a
  web page that forgets more easily and doesn't work at the gym. (The app
  still runs — it falls back gracefully — but you lose the important parts.)
- **The fix if you want this:** [Tailscale](https://tailscale.com) is a free
  private network for your own devices; its `tailscale serve` command gives
  your laptop a real `https://` address your phone can reach from anywhere —
  including the gym.
- **Good for:** trying changes on your phone while you develop.

#### Option B — Host it on a hosting site

Run `npm run build`, upload the `dist/` folder to a static host. Good free
choices: **Netlify**, **Cloudflare Pages**, **Vercel**, or **GitHub Pages**
(free for public repositories). You get a permanent `https://` address.

- **Where your workouts are:** *still on the phone.* The host only serves
  the app's files. It never sees a single set you log.
- **HTTPS is automatic,** so Home Screen install, offline mode and persistent
  storage all work.
- **After the first visit,** the app's files are cached on your phone (the
  *service worker* does this), so it opens even if the host is down.
- **Cost:** £0 for one person.
- **Good for:** actually using it. **This is the recommended next step.**

The app is configured so this just works: relative file paths
(`base: './'` in `vite.config.ts`) let it run from any folder, and the
`#` in addresses (`…/#/m/abc`) means the host needs no special settings.

#### Option C — Host your data too (when you want it)

You'd want this when you want your workouts on more than one device, want
them to survive losing your phone without manual backups, or want to look at
them on a laptop. Now a server holds a copy of your data — and **that** is
the moment you need a login, because the server must know the data is yours.

| Route | What it is | Trade-off |
|---|---|---|
| **Supabase** | Hosted Postgres database with login built in | Generous free tier (inactive free projects can be paused — check current limits). Standard SQL. |
| **Firebase** (Google) | Hosted document database with login built in | Has offline support built in, which fits this app's "works with no signal" design well. Ties you to Google. |
| **Your own server** | A small API (e.g. Node + SQLite) on Fly.io/Render, or a home server reached via Tailscale | Most control and learning; you handle security, backups and uptime. |

**How it plugs in.** Everything talks to storage through one small
interface, `MesoRepository` in `src/storage/repository.ts`:

```ts
interface MesoRepository {
  list(): Promise<Meso[]>
  get(id: string): Promise<Meso | undefined>
  save(meso: Meso): Promise<void>
  remove(id: string): Promise<void>
}
```

You'd write a `SupabaseRepository` with those same four methods and change one
line in `src/main.tsx`. No screen changes.

**The honest hard part: offline.** At the gym you might have no signal, so
you can't *only* save to a server. The proper design is "local-first": keep
IndexedDB as the main store (exactly as now) and *sync* to the server in the
background when there's a connection. Each meso already has an `updatedAt`
timestamp, which is enough for a simple rule — "the newest version of each
meso wins". That's fine for one person on one phone at a time.

---

## 4. Login options

**You don't need a login yet.** Today nothing leaves your phone, and your
phone's own lock (Face ID / passcode) is what protects your data. A login only
matters once data is on a server (Option C).

When you get there, the options, simplest first:

| Option | How it feels | Notes |
|---|---|---|
| **No login** (now) | Open and go | Fine while data stays on the phone. |
| **One password** on your own server | Type a password once per device | Simplest for a single user on a self-hosted server. Only safe over HTTPS. |
| **Email magic link** | Type your email, tap the link it sends you | No password to forget. Built into Supabase and Firebase. |
| **Sign in with Apple / Google** | Tap one button | Uses accounts you already have ("OAuth"). Apple's App Store rules say a native app offering Google login must also offer an equivalent privacy-focused option such as Sign in with Apple — so for a future iPhone app, include Apple. |
| **Passkeys** | Face ID, no password at all | The newest option, and the most secure. Check whether your chosen provider supports them. |

How a login works underneath: you prove who you are once; the server gives
the app a **session token** (a long random string, like a wristband at a
festival); the app sends the token with every request; the server checks the
wristband instead of asking for your password again. Tokens expire and get
refreshed.

**Rule of thumb: never build password storage yourself.** Use a provider
(Supabase Auth, Firebase Auth, Sign in with Apple). Storing passwords safely
is genuinely hard and getting it wrong is how leaks happen.

**Recommendation for you:** Sign in with Apple (you're on iPhone, and it's
required alongside other social logins for the App Store anyway) plus email
magic link as a fallback, via Supabase or Firebase.

---

## 5. Becoming a native iPhone app later

Two routes. Both keep your data via the backup file.

**Route 1 — Wrap this app with Capacitor (least work).**
[Capacitor](https://capacitorjs.com) puts this exact web app inside a native
iOS shell. Same code, same screens; you can add native features (haptics,
notifications, HealthKit via plugins). You'd likely swap IndexedDB for native
SQLite — another `MesoRepository`, one-line change.

**Route 2 — Rewrite in SwiftUI.** A fully native app. The domain rules in
`src/domain/` port almost line-for-line to Swift, and because the config file
and backup formats are plain JSON, the native app can read the same files.

**Either way you need:** a Mac with Xcode, and the Apple Developer Program
(US$99/year) to put it on your phone long-term, use TestFlight, or publish to
the App Store.

**Important:** the web app's data does **not** move into a native app by
itself — they're separate storage boxes on the phone. Save a backup in the web
app, restore it in the native one. That's one reason the backup format exists.

**And maybe you won't need to.** A Home Screen web app already opens
full-screen, works offline, and keeps its data. Use it for a full meso first.

---

## 6. Config files

A config file describes a meso's structure — days, exercises, set targets —
with **no results**. Write one by hand, import it, or export one from any
meso's ⋯ menu. A full example is in
[`examples/meso-config.example.json`](../examples/meso-config.example.json);
the app's Data screen can also download it.

```jsonc
{
  "version": 1,                     // optional
  "name": "Meso 5 - Mass 2",        // required
  "units": "lb",                    // "lb" or "kg"; default "lb"
  "trainingWeeks": 4,               // weeks before the deload; default 4
  "days": [
    {
      "name": "Upper 1",
      "exercises": [
        // Short form: every set the same
        { "name": "Incline DB Bench", "sets": 3, "reps": "8-12", "rir": "1-2", "weight": 75 },

        // Long form: each set spelled out
        { "name": "Cable Pushdown", "sets": [
            { "reps": "10-15", "rir": "2", "weight": 57.5 },
            { "reps": "10-15", "rir": "0", "weight": 50 }
        ] }
      ]
    }
  ]
}
```

(`//` comments are for this explanation only — real JSON files can't have
them.)

| Field | Required | Meaning |
|---|---|---|
| `name` | ✅ | Meso name |
| `units` | | `"lb"` or `"kg"` |
| `trainingWeeks` | | 1–12. The deload is always added after these. |
| `days[].name` | ✅ | e.g. `"Upper 1"`. Up to 7 days. |
| `exercises[].name` | ✅ | |
| `exercises[].sets` | ✅ | A number (short form) or a list (long form), 1–20 sets |
| `reps` | ✅ in short form | Text or a number: `"8-12"`, `10`, `"45s"` |
| `rir` | | Text or a number: `"1-2"`, `0` |
| `weight` | | A number, or leave it out to decide on the day |

In the long form, `rir` and `weight` on the exercise act as defaults for any
set that doesn't give its own.

**Mistakes are caught precisely.** Unknown fields are errors — a typo like
`"rep"` is reported instead of silently ignored — and every problem names its
exact location:

```
days[0].exercises[0]: unknown field "rep"
days[0].exercises[0].reps: is required when "sets" is a number
```

**Config vs backup:** a *config* is a plan you can write by hand and reuse. A
*backup* is everything including results, for moving or restoring data. The
app tells you if you hand it one when it expected the other.

---

## 7. Project map

```
workout-app/
├── src/
│   ├── domain/              The rules. Pure TypeScript; tested without a browser.
│   │   ├── types.ts           Meso / Week / Day / Exercise / Set, plus "plans"
│   │   ├── meso.ts            Create a meso, add/remove weeks, progress, "up next"
│   │   ├── logging.ts         Log / skip / undo sets, skip days & exercises, suggestions
│   │   ├── editing.ts         Change a day's exercises for one week or onwards
│   │   ├── config.ts          Read and write config files (with exact error messages)
│   │   ├── backup.ts          Read and write backup files
│   │   ├── validation.ts      Friendly checks for the in-app editors
│   │   └── *.test.ts          Tests
│   ├── storage/             Where data lives
│   │   ├── repository.ts      The MesoRepository interface (the swap point)
│   │   ├── indexedDb.ts       Today's implementation: the browser's database
│   │   └── persistence.ts     "Please don't clear my data", Home Screen detection
│   ├── state/               In-memory copy of your data while the app is open
│   ├── screens/             One file per screen
│   ├── ui/                  Shared components, formatting, the plan editor
│   ├── App.tsx              Routes (which screen for which address)
│   └── main.tsx             Start-up: picks the storage and starts the app
├── examples/                An example config file to copy and edit
├── public/                  Icons
└── vite.config.ts           Build settings, incl. the offline/install (PWA) setup
```
