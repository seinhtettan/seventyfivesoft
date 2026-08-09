# 75 Soft

A private, offline-first wellness journal for a bounded challenge you define yourself.
Consistency over perfection.

The app is one TypeScript deployment:

- Vite + React PWA for the interface.
- IndexedDB as each browser's durable working database.
- A transactional local outbox for edits made offline.
- A small Hono/Node API for record-level synchronization.
- SQLite as the central shared database.

There is no separate backend service, account model, or analytics service. The intended
installation is for one person and should be protected at the edge, such as with Cloudflare
Access.

## Development

Install dependencies:

```bash
npm ci
```

Run the API in one terminal:

```bash
npm run dev:server
```

Run Vite in another:

```bash
npm run dev
```

Vite proxies `/api/*` and `/healthz` to the API on port 8080. Open the URL printed by Vite.
The development database defaults to `.data/seventyfivesoft.sqlite`.

Run all checks:

```bash
npm run check
```

Build and run the production server locally:

```bash
npm run build
DATABASE_PATH=.data/seventyfivesoft.sqlite npm start
```

The production Node process serves both the API and the built SPA on port 8080.

## How it works

The first run asks for the challenge window, profile, and habits. Daily habits, weekly
habits, optional metrics, journal entries, reflections, and progress check-ins are editable
offline.

| Page | What's there |
| --- | --- |
| Today | Progress, day counter, habit checklist, weekly habit summary, journal nudge |
| This week | Seven-day view, habit totals, metric averages, weekly reflection |
| 75 days | Every challenge day with completion state |
| Progress | Optional weight, mood, energy, and a lightweight SVG trend chart |
| Journal | Today's prompts and previous entries |
| Settings | Dates, habits, profile, units, sync conflicts, backup/restore, reset |

Weight is stored canonically and converted for display. Changing between pounds and
kilograms does not reinterpret existing measurements.

## Offline persistence and synchronization

Zustand provides reactive UI state but is not the durable database. IndexedDB stores:

- normalized records;
- the current workspace snapshot;
- pending outbox mutations;
- the server cursor and browser replica ID;
- unresolved conflicts.

A local edit updates the workspace, normalized records, and outbox in one IndexedDB
transaction. Synchronization runs at startup, after edits, when the browser comes online or
regains focus, and periodically while visible.

`POST /api/sync` sends the browser cursor and pending mutations. Mutation IDs make retries
idempotent. Per-record base versions detect stale writes; device clocks do not decide the
winner. Deletions propagate as versioned tombstones so a browser that was offline for a long
time still learns what was removed.

If two devices changed the same record, Settings offers two explicit choices:

- **Keep this device** rebases and retries the local change.
- **Use synced version** discards the pending local change and installs the server copy.

The service worker never caches `/api/*` or `/healthz`.

### Migration from the browser-only version

On first launch, an existing `localStorage["75soft:v1"]` snapshot is normalized into
IndexedDB and queued for upload. The legacy key is removed only after that transaction
succeeds. Existing export files remain importable from Settings.

Settings still provides **Export a backup** and **Restore from file** as a human-readable
backup and recovery path. Clearing one browser's site data removes that browser's offline
copy, not the central SQLite database; the browser downloads the shared records again after
reopening the app.

## HTTP surface

- `GET /healthz` — liveness/readiness and current synchronization cursor.
- `GET /api/health` — same health response.
- `POST /api/sync` — validated synchronization request, limited to 1,000,000 bytes.

API responses use `Cache-Control: no-store`. Fingerprinted frontend assets are immutable;
the SPA shell, manifest, and service worker are revalidated.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Node listen port |
| `DATABASE_PATH` | `.data/seventyfivesoft.sqlite` | Writable SQLite database path |
| `STATIC_ROOT` | `dist` | Built Vite asset directory |

The API has no application-level authentication because this is a single-person home app.
Do not expose it directly to the public internet. Put the whole origin behind Cloudflare
Access or an equivalent trusted reverse proxy.

## Docker

Build and run with persistent storage:

```bash
docker build -t seventyfivesoft:local .
docker run --rm \
  -p 8080:8080 \
  -v seventyfivesoft-data:/data \
  seventyfivesoft:local
```

The image runs one non-root Node process. It includes a health check and stores the database
at `/data/seventyfivesoft.sqlite` by default. The build installs native build tools only in
intermediate stages so `better-sqlite3` works on both amd64 and arm64 without carrying a
compiler in the runtime image.

Every push to `master` publishes multi-architecture images to:

```text
ghcr.io/seinhtettan/seventyfivesoft:latest
ghcr.io/seinhtettan/seventyfivesoft:sha-<commit>
```

## Kubernetes deployment requirements

SQLite has one writer. Run exactly one application replica with a `Recreate` rollout
strategy and a persistent volume mounted at `/data`. If the volume is provisioned with root
ownership, set pod `fsGroup: 1000` for the image's non-root user.

Recommended production storage shape:

- local-path PVC for the live SQLite database;
- Litestream replication to a separate NAS/NFS-backed destination;
- Cloudflare Tunnel for ingress;
- Cloudflare Access restricted to the intended person's email.

Do not run multiple active application replicas against the same SQLite file.

## Database operations

Schema migrations run automatically in ordered transactions during startup. Concurrent
startup is serialized with `BEGIN IMMEDIATE`; a failed migration rolls back. The server
refuses to open a schema version newer than the running binary.

SQLite runs in WAL mode. For raw file backups, stop the process or use SQLite's backup
mechanism rather than copying only the main database while it is active. Litestream is the
recommended continuous backup mechanism. Keep Settings exports as an additional portable
backup.

## PWA installation

Serve the app over HTTPS, open it in Safari on iPhone, then use **Share → Add to Home
Screen**. The shell and icons are precached, and journal/habit edits continue working without
a connection. Deep links resolve to the SPA shell both online and offline.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · Radix primitives · Zustand · IndexedDB ·
Hono · Node 22 · better-sqlite3 · Zod · date-fns · react-day-picker · lucide-react ·
vite-plugin-pwa/Workbox.
