# whoami

A lightweight link page: one Cloudflare Worker serves static assets and an API
backed by Workers KV. Reads are public; writes require an admin session.
The same frontend/backend deploy twice from GitHub for James Jared and TheCyberGay,
with separate KV namespaces and secrets. Both deployments use this source folder;
the sibling `thecybergay/` folder is the legacy static site and is not deployed.

## Structure

```text
whoami/
  thecybergay/          Legacy static site; not changed or deployed by this app
  jamesjared/           Application and Cloudflare project root
    public/            Public browser assets; never put secrets here
      index.html
      links.js         API loading, login/edit wiring, five-tap reveal, redirects
      js/
        link-list.js   Rendering, add/delete, drag/keyboard ordering, editing state
        link-dialog.js Modal and validation
        icon-picker.js Icon rendering and search
        link-data.js   Ordering and unique IDs; shared with tests
        link-saver.js  Save queue and retries
        auth-dialog.js Login, session checks, logout
        profile.js     Loads handle, avatar, favicon, and title from KV
      style.css
      me.jpg           James Jared profile image
      thecybergay.jpg   Shared CyberGay image asset
      vendor/          Generated dependencies and icon catalog; Git-ignored
    src/               Server-only; not served as assets
      index.js         Worker entry point (wrangler.jsonc main)
      auth.js          Login, sessions, write authorization
      link-validation.js Schema and size limits
      profile.js       Public profile validation
    tests/
      auth.test.js     Authentication/security
      worker.test.js   API
      link-validation.test.js Schema boundaries
      link-saver.test.js Queue/transport
      link-data.test.js Ordering/IDs
      icon-catalog.test.js Free icon filtering
      profile.test.js  Namespace-backed identity
    dev/
      links.json       Optional local link seed
      profile.jamesjared.json James Jared profile seed
      profile.thecybergay.json CyberGay profile seed
    scripts/
      build.js         Copies vendor assets and generates icon catalog
      icon-catalog.js  Converts official metadata to picker data
    .node-version      Node 24.22.0, selected by fnm
    .dev.vars          Local secrets; Git-ignored, not uploaded
    package.json       Commands and dependencies
    package-lock.json  Exact dependency versions; commit this
    wrangler.jsonc     Worker entry point, assets, routes, dev server, KV binding
    .vscode/tasks.json Local preview task
```

## Architecture

```text
Browser -> Static Assets -> public/ HTML, CSS, JavaScript
Browser -> /api/* -> Worker -> SITE_DATA KV namespace, keys: links and profile
```

Native ES modules (`type="module"`), no framework or bundler. The list delegates
events so new and existing rows behave identically; module responsibilities are
listed above. Cloudflare runs the backend in Workers, not a persistent Node server.

`/api` and `/api/*` always run the Worker. Unknown API routes return JSON 404;
unsupported methods return 405. Same-origin requests need no CORS configuration.
Unmatched page paths serve the index: `/instagram`, for example, highlights its
matching link and redirects after 1.5 seconds. Login activation cancels the redirect.

### Profile Data

Each namespace stores a separate `profile` key containing public JSON:

```json
{
  "handle": "@jams_jard",
  "imagePath": "/me.jpg"
}
```

The CyberGay seed uses `@thecybergay` and `/thecybergay.jpg`. Both images
are deployed to both sites; only the namespace selects the displayed path.
`imagePath` is a root-relative, same-site path (maximum 2048 characters, no
backslashes, whitespace, queries, or fragments); handle is 1-120 characters.
`GET /api/profile` sets the visible handle, image/alt text, favicon, page title,
and legacy photo-popup references. Profile and link requests are independent.
Missing profile data leaves the handle/photo blank and title `whoami`, with no
site-specific fallback. Invalid profile data or KV failures return 503 without
blocking links. Edit the key in Cloudflare KV or upload a seed with Wrangler;
the profile endpoint is read-only. Link autosaves never modify `profile`.

### Link Data

KV holds one JSON document keyed by stable short-link ID. Link data is public:

```json
{
  "instagram": {
    "title": "Instagram",
    "url": "https://www.instagram.com/jams_jard",
    "icon": "fab fa-instagram",
    "order": 10
  }
}
```

- Missing `links` or `{}` returns `{}` and a blank links area; no bundled defaults.
- Display sorts by ascending `order`, independent of JSON property order. Use
  spaced values (10, 20, 30) for inserts. Unranked entries appear last; ties keep
  JSON entry order. Reordering never changes short URLs.
- KV is eventually consistent: **Saved** confirms write acknowledgment, not
  immediate visibility at every Cloudflare location.
- Saves replace the whole document. Concurrent tabs, devices, or Workers can
  overwrite each other or exceed KV's per-key write rate. The queue coordinates
  only one page; use a Durable Object/coordinated store for concurrent editors.
  KV alone cannot provide atomic conflict checks.

## Local Development

**Tools:** fnm (Fast Node Manager) installs/switches Node via `.node-version` (24.22.0).
Node runs local tools/tests; npm ships with Node and manages packages/commands.
Wrangler is a development dependency, not browser code.

On macOS, install fnm and add its shell hook once:

```sh
brew install fnm
```

Add to `~/.zshrc`, then open a new terminal:

```sh
eval "$(fnm env --use-on-cd --shell zsh)"
```

Run from `jamesjared`:

```sh
fnm install
fnm use
npm ci
npm test
npm run dev
```

`npm ci` uses the committed lockfile; use `npm install` to add/update dependencies.
No Cloudflare login is needed locally. The dev server binds `0.0.0.0:8787`:
http://localhost:8787 or `http://<your-LAN-IP>:8787`. LAN IPs can change; macOS
may require allowing incoming firewall connections. This is dev-only, but
exposes public reads and login to the network: use trusted networks.

### Local Secrets and Data

This machine's Git-ignored `.dev.vars` contains `ADMIN_USERNAME=admin`,
`ADMIN_PASSWORD=pass`, a development `SESSION_SECRET`, and
`ALLOW_INSECURE_LOCAL_AUTH=true`. On another checkout, create these four bindings;
use a signing key of at least 32 characters. Restart Wrangler after changes.

The HTTP exception requires that flag **and** a localhost/private IPv4 hostname.
It uses a separate `dev_session` cookie without Secure. HTTP credentials/sessions
are unencrypted: use only dev credentials on trusted networks. Never copy the dev
credentials/key or set `ALLOW_INSECURE_LOCAL_AUTH` in production.

Local KV persists in Git-ignored `.wrangler/`, separate from production:

| Command | Effect |
| --- | --- |
| `npm run seed:local` | Replace local KV with the eight links in `dev/links.json` |
| `npm run seed:profile:jamesjared` | Set local `profile` to James Jared |
| `npm run seed:profile:thecybergay` | Set local `profile` to TheCyberGay |
| `npx wrangler kv key delete links --binding SITE_DATA --local` | Empty local links |

Edit the seed and rerun to change local data/order, then refresh. It is never
loaded automatically, imported by the Worker, deployed, or used as a fallback.
Production stays empty until explicitly populated through the editor or KV tools.

## Editing

- Tap/click the profile picture **five times** to sign in and reveal editing
  controls (the photo popup is no longer used). A valid session skips login.
  Refresh hides controls but preserves the session; five taps reopen editing.
- Drag right-edge handles with mouse/touch, or focus a handle and use Arrow Up,
  Arrow Down, Home, or End. Link navigation is disabled while editing.
- Red trash buttons outside the boxes delete immediately. **Add link** opens
  required title/HTTP(S) URL fields and a searchable free-icon picker. New links
  appear first, with title-based IDs and numeric suffixes to avoid collisions.
  Cancel, Close, or Escape dismisses without adding.
- Every add/delete/reorder autosaves the complete document, preserving IDs and
  assigning display-order values. Rapid edits coalesce; requests are serialized
  with a 1.1-second buffer before the next save to respect KV's per-key rate.
- Status shows Saving, Saved, or an error with Retry. Saves time out after 15
  seconds. Failures preserve the latest edits in memory; Retry resends them,
  asking for login if expired. No browser-storage backup exists.
- Wait for Saved before refreshing. Pending/failed edits trigger an unload
  warning and disable sign-out. Failed initial API loads leave editing locked.
- The sign-out icon clears this browser's session cookie and locks editing.
  Five taps are only a reveal gesture; the Worker authorizes every write.

### Icons and Build

`npm run build` copies SortableJS (mouse/touch dragging), Font Awesome CSS,
webfonts, and license into Git-ignored `public/vendor/`. It generates
`vendor/icons.js` from `@fortawesome/fontawesome-free/metadata/icon-families.json`,
filtering free classic solid/regular/brand variants (2,060 in version 6.7.2).
Search uses official names, labels, aliases, and terms; labels distinguish styles.
No hand-maintained list, Font Awesome API key, or runtime vendor CDN is needed.

Matching fonts/CSS live at `public/vendor/fontawesome/`. To refresh icons, install
a newer Font Awesome package, rebuild, and commit package/lockfile changes.
Build runs automatically before `npm run dev` and `npm run deploy`.

## API

| Route | Behavior |
| --- | --- |
| `GET /api/links` | Public link document; missing data returns `{}` |
| `GET /api/profile` | Public handle/image path from `profile`; missing key returns `{}`; writes return 405 |
| `PUT /api/links` | Authenticated JSON replacement; omitted IDs delete, `{}` clears all; returns `{"saved":true}` |
| `POST /api/login` | JSON `{ "username": "...", "password": "..." }`; sets session cookie |
| `GET /api/session` | `{ "authenticated": true/false }`; no token returned |
| `POST /api/logout` | Expires this browser's session cookie |

API responses use `Cache-Control: no-store`; browser link loads bypass HTTP
caching. PUT requires `Content-Type: application/json` and writes only `links`.

**Write validation:** 64 KiB/request, 200 links, 120 characters/title,
2048/URL, 128/ID. IDs start with a letter/digit and contain only letters, digits,
underscores, or hyphens; reserved object keys are rejected. URLs must be absolute
HTTP/HTTPS. Icons accept solid/regular/brands class pairs (including legacy
`fas`, `far`, `fab`); orders are nonnegative safe integers. Unknown fields are
discarded from storage.

**Errors:** 400 invalid JSON/schema; 401 missing/invalid write session (before
KV access); 403 cross-origin browser login/logout/write requests or insecure
login outside the local exception; 404 unknown route; 405 unsupported method;
413 oversized link body; 415 non-JSON write; 429 login throttling; 503 failed KV
reads/writes or unconfigured login. Login bodies are limited to 4 KiB.

## Authentication

No account database or external auth service. `jose` signs/verifies eight-hour,
origin-scoped HS256 JWTs using `SESSION_SECRET`. Cookies are `HttpOnly`,
`SameSite=Strict`, and over HTTPS, `Secure` with the `__Host-` prefix and no
Domain attribute. Strict cookies and Origin/Sec-Fetch-Site checks provide CSRF
protection; no CORS permissions are enabled. HTTP is local-only as described above.

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are Worker secrets. Credential comparison
uses fixed-length SHA-256 digests (comparison hardening, **not** password-hash
storage); the actual password remains a secret. Credentials/tokens are never
returned in JSON or stored in localStorage. Missing secrets lock writes/login.

Five attempts/client IP/15 minutes are allowed **per Worker instance**, with
429 and Retry-After when exceeded. The in-memory counter resets on restart and
is not shared: it is not robust distributed brute-force protection or global
rate limiting. Use a strong password; add edge rate limiting if needed.

### Secrets and Rotation

Set production secrets separately per deployment via interactive prompts:

```sh
npx wrangler secret put ADMIN_USERNAME --env jamesjared
npx wrangler secret put ADMIN_PASSWORD --env jamesjared
npx wrangler secret put SESSION_SECRET --env jamesjared
```

Repeat with `--env thecybergay`. Use independent signing keys for the two sites.

Use a strong unique password and independent random signing key of at least
32 characters (for example, 32 random bytes encoded as hex). Cloudflare's Worker
Settings > Variables and Secrets also supports Secret-type values. Never put
secrets/API tokens in Git, `wrangler.jsonc`, or browser code; `.dev.vars` is not
uploaded. No extra KV keys store passwords or sessions.

Rerun these commands to change credentials without code changes. Existing
sessions last until expiry; rotate `SESSION_SECRET` to invalidate all at once.
Logout clears only this browser's cookie. There is no server-side revocation
list: a copied token remains valid until expiry or signing-key rotation.

## Deployment

### One-Time Cloudflare Setup

From `jamesjared`, sign in and create one namespace per named environment:

```sh
npx wrangler login
npx wrangler kv namespace create SITE_DATA --env jamesjared
npx wrangler kv namespace create SITE_DATA --env thecybergay
```

Replace each environment's all-zero `id` in `wrangler.jsonc` with its own returned
namespace ID (not a secret). Both bindings stay named `SITE_DATA`, but **the IDs
must differ** to isolate each site's links and profile. Named environments deploy
Workers called `jamesjared` and `thecybergay`; set each Worker's domain in Cloudflare.
The top-level namespace/name remain the existing default development/legacy target.
Always specify `--env` for production commands to avoid deploying the wrong target.

Seed each production profile, then configure its secrets as described above:

```sh
npx wrangler kv key put profile --binding SITE_DATA --path dev/profile.jamesjared.json --remote --env jamesjared
npx wrangler kv key put profile --binding SITE_DATA --path dev/profile.thecybergay.json --remote --env thecybergay
```

Empty links are supported. Populate through the editor, dashboard, or Wrangler:

```sh
npx wrangler kv key put links '{"instagram":{"title":"Instagram","url":"https://www.instagram.com/jams_jard","icon":"fab fa-instagram","order":10}}' --binding SITE_DATA --remote --env jamesjared
```

`--remote` writes production; use `--local` without `--env` for the default local KV.
Profile seed commands replace only `profile`, not links. The editor uses its
session cookie and Worker API, never a Cloudflare API token. Deploy manually:

```sh
npm run deploy -- --env jamesjared
npm run deploy -- --env thecybergay
```

### GitHub Deployment

In Workers & Pages, connect each **Worker** to this same GitHub repository and
configure Workers Builds separately:

| Setting | Value |
| --- | --- |
| Root directory | `jamesjared` |
| Production branch | Your deployment branch |
| Build command | `npm test` |
| Deploy command (James Jared) | `npm run deploy -- --env jamesjared` |
| Deploy command (TheCyberGay) | `npm run deploy -- --env thecybergay` |
| Node | `24.22.0` (`NODE_VERSION` if needed) |

Cloudflare installs npm dependencies first; deployment builds vendor assets and
the icon catalog automatically. Commit the application, lockfile, and real KV IDs.
Branch pushes deploy each configured Worker from this shared app, not the legacy
sibling site's files. Use
Wrangler login locally and Cloudflare's managed Git integration for deployment.