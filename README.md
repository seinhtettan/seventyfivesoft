# 75 Soft

A personal, bounded wellness tracker — a Pinterest-style digital journal for a 75-day
challenge you define yourself. Consistency over perfection.

No backend, no account. Everything lives in your browser.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open the printed localhost URL. To build for production:

```bash
npm run build
```

`npm run preview` serves the built output.

## How it works

**First run** walks you through four steps: your date window (pretty date picker, end date
auto-fills to 75 days and the length is adjustable), your profile, your habits, and a
review before you lock it in. All of it is editable later in Settings.

**Daily habits** are ticked on the dashboard. Some carry an optional number alongside them
— minutes walked, glasses of water, hours slept — which feed the weekly averages.

**Weekly habits** (Pilates by default) are counted per week against a target of 2, with a
third session shown as a bonus. They never count against a daily total, and a missed day
never resets anything.

### Pages

| Page | What's there |
| --- | --- |
| Today | Progress ring, day counter, greeting, habit checklist, weekly habit card, journal nudge |
| This week | Completion ring, 7-day strip, per-habit tallies and streaks, metric averages, reflection |
| 75 days | Every day as a tile — day number, date, completion, soft colour states |
| Progress | Optional weight/mood/energy check-ins and a trend chart against your goal |
| Journal | Today's win, gratitude, how you felt, notes — plus every earlier page |
| Settings | Dates, habits, profile, weights, lb/kg, export & restore, reset |

## Data & persistence

State is held in a [zustand](https://zustand.docs.pmnd.rs/) store persisted to
`localStorage` under the key **`75soft:v1`** — habits, ticked days, logged metrics, journal
entries, weekly reflections, progress check-ins, profile and settings. Close the tab,
reopen it, and everything is where you left it.

Weight is always stored canonically in pounds and converted for display, so switching
between lb and kg is lossless.

Settings has **Export a backup** (downloads a JSON file) and **Restore from file**, which
is the way to move data to another browser or device — there is no sync.

Clearing your browser's site data for this origin erases the challenge, so take a backup
before you do that.

## Installing it on an iPhone

The app is a PWA, so it installs to the home screen and runs without browser chrome.

1. Host the `dist/` folder over **HTTPS** (service workers won't register otherwise —
   `localhost` is the only exception).
2. Open the site in **Safari** on the iPhone.
3. Share → **Add to Home Screen**.

It then launches fullscreen with its own icon, no address bar, and works with no
connection at all — the app shell, icons and fonts are precached, so you can tick habits
and write journal entries on a plane. Verified by loading it with the server stopped.

**One hosting requirement:** it's a single-page app, so the host must rewrite unknown
paths to `index.html`, otherwise a refresh on `/week` or a deep link 404s. On Netlify
that's a `_redirects` file containing `/* /index.html 200`; Vercel and Cloudflare Pages do
it automatically for SPAs; nginx needs `try_files $uri /index.html`.

### What's already handled for iOS

- `apple-touch-icon.png` at 180×180 — iOS ignores SVG icons and would otherwise use a
  blurry screenshot of the page
- Manifest with `display: standalone`, maskable icon, and cream theme/background colour so
  there's no white flash on launch
- Safe-area insets top and bottom, so the header clears the Dynamic Island and the tab bar
  clears the home indicator
- Form fields are 16px on phones — below that, iOS zooms the whole page when you tap a
  field, which is the single most common way an installed web app feels broken
- Overscroll chaining and long-press callouts disabled, so it doesn't rubber-band or offer
  to select text like a web page

Because everything is stored locally, use **Settings → Export a backup** now and then; that
file is the only copy if the device is wiped or you clear site data.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style Radix primitives ·
zustand · date-fns · react-day-picker · Recharts · Framer Motion · lucide-react ·
vite-plugin-pwa (Workbox).

Type `Cormorant Garamond` (headings), `Jost` (body), `Caveat` (handwritten accents),
loaded from Google Fonts.

## Layout notes

Responsive from 375px up: a bottom tab bar and stacked cards on phones, a fixed left rail
on tablets and desktop. The Progress page is code-split so the charting library only loads
if you open it.
