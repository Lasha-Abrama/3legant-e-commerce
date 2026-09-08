# Backend audit — 8 September 2026

## Outcome

The requested backend features have been inspected and confirmed defects fixed.
The API contracts are ready for frontend integration. Google Sign-In and outgoing
email still require your service configuration and live acceptance tests; they
must not be described as fully operational yet. No frontend code was changed as
part of this audit. Existing frontend/map changes from the earlier task remain.

## Feature-by-feature verification

All paths below include the `/api` prefix. Every row was reviewed for routing,
controller/service wiring, persistence, input validation, authorization, error
handling, environment requirements, and security. Automated evidence is described
separately so code inspection is not confused with live provider testing.

| Feature | Routes and implementation | Persistence and validation | Access, errors, security | Readiness |
| --- | --- | --- | --- | --- |
| User Sign Up | `POST /auth/register`; AuthController → AuthService → UsersService | User schema; normalized email with a live unique index; required trimmed string names; password minimum 8 characters, maximum 72 UTF-8 bytes; bcrypt hashing | Public, 5/hour/IP; rejects extra fields such as `isAdmin`; duplicate email becomes 400; safe user response excludes hashes and reset tokens | Implemented and tested; does not include email ownership verification |
| Email/password authentication | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`; password change via `PATCH /users/me/password`; recovery via `POST /auth/forgot-password` and `/auth/reset-password` | Hidden password hash; JWT contains user ID and token version; atomic token-version changes and single-use reset-token consumption | Login 5/minute/IP; invalid credentials 400, protected routes 401; `/auth/me` intentionally returns `{user:null}` for an anonymous/invalid session; password changes revoke old tokens and reset links | Implemented and tested; recovery email needs Resend |
| Google Sign-In | `GET /auth/google`, `/auth/google/callback`, `/auth/google/session`; GoogleOAuthService exchanges authorization code and verifies ID token | User `googleId` has a live sparse unique index; verified email and Google subject required; new Google accounts can omit password hash | Signed state with server-enforced 10-minute expiry; same-origin redirect; HttpOnly/SameSite cookies, Secure in production; no token in redirect URL; no automatic email-only account merging; token response is not cacheable | Code and mocked provider checks pass; OAuth credentials absent locally |
| Nodemailer | Internal EmailService, no public generic mail-sending route; EmailModule imported by ContactModule | Reusable SMTP transport; sender/recipient/header validation; escaped HTML plus plain text templates | STARTTLS or implicit TLS, certificate validation, network timeouts, no arbitrary URL/file attachments; generic 503 errors; raw SMTP diagnostics not exposed | Implemented and tested with mocked SMTP; sender configuration absent |
| Contact Us | `POST /contact`; `GET /admin/contact-messages`; `DELETE /admin/contact-messages/:id` | ContactMessage timestamps, normalized email; name ≤100, email ≤254, message ≤5000 characters; whitespace-only values rejected | Submission public, 5/15 minutes/IP; admin listing/deletion require current admin role; deletion IDs validated; data is saved before email; failure reports saved-but-email-unavailable | Implemented and tested; SMTP required for full successful submission flow |
| Contact confirmation emails | ContactService sends customer confirmation and company notification through EmailService | Confirmation follows successful persistence; customer content escaped; notification uses validated Reply-To | Parallel deliveries settled before returning; any failed delivery yields safe 503 without rolling back the message | Templates and failure behavior tested; real mailbox acceptance/delivery not tested |
| Newsletter subscriptions | `POST /newsletter`; `GET /admin/newsletter-subscribers`; `DELETE /admin/newsletter-subscribers/:id` | NewsletterSubscriber unique normalized email; atomic upsert; confirmation/notification delivery flags and expiring delivery claim | Public subscription 5/15 minutes/IP; admin-only list/delete; duplicate/concurrent subscriptions do not trigger concurrent delivery attempts | Implemented and tested; actual emails require SMTP |
| Newsletter confirmation emails | ContactService → EmailService; no extra frontend endpoint | New subscriptions track individual delivery outcomes; re-submission retries failed delivery while skipping known successes | Claim limits concurrent sends; SMTP acceptance is not guaranteed inbox delivery; legacy subscribers are not retroactively emailed | Implemented and tested; welcome acknowledgement, not double opt-in or a bulk campaign system |
| Profile picture uploads | `PATCH /users/me/profile-image`; ProfileImageController → ProfileImagesService | User stores public HTTPS image URL and hidden Cloudinary public ID; replacement is atomic so cleanup uses the actual previous image | JWT required; target user always comes from token; 5/15 minutes/IP; new upload cleaned up on DB failure, old image cleaned up after success | Implemented and tested; Cloudinary credential ping succeeded |
| Multer validation | Profile upload field `image`; admin image route `POST /admin/uploads/image` uses `file` | Profile: 1 file, 2 MiB, JPEG/PNG/WebP; admin: 1 file, 4 MiB, JPEG/PNG/GIF/WebP; no text fields; byte signatures checked, not only filename/MIME | JWT/admin guard before upload; missing/invalid/extra fields return 400; excessive size returns 413; Cloudinary additionally decodes accepted image input | HTTP boundary tests pass; header detection alone is not a full image decoder |
| Cloudinary integration | UploadsService configures server SDK from environment; signed server uploads; scoped profile deletion | Product/profile folders separated; random per-upload profile public ID; public URL persisted, private API secret never returned | Provider errors converted to generic 503; cleanup limited to profile folder; best-effort cleanup failure logs no credentials | Live credential ping passed; upload/cleanup paths mocked in tests, no live file uploaded |
| Browser location requirements | Browser API only; no geolocation backend route or database field | Optional permission; coordinates retained in browser memory; no coordinates accepted in Contact DTO | HTTPS or localhost; `Permissions-Policy: geolocation=(self)`; blocked/denied/timeout cases retain company map and contact form | Backend requirements ready; existing browser tests cover success/denial |
| Contact map requirements | Existing static Leaflet + OpenStreetMap map, served by NestJS/Vercel | Demo company marker; client-side straight-line distance; Google Maps URL for road directions | Local Leaflet assets fit CSP; HTTPS tiles allowed; origin referrer permitted; no map API key; attribution required | Ready; sample address must be replaced before presenting it as a real business |

## Confirmed problems fixed

1. Signup names and login/old-password inputs accepted wrong JSON types or blank
   names; profile updates allowed explicit null values. Added string, trimming,
   size, and null checks without changing the successful API response shapes.
2. Password-setting endpoints allowed values beyond bcrypt's 72-byte limit, which
   could silently truncate distinct passwords. Added UTF-8 byte limits. Existing
   login passwords retain compatibility within a bounded 1024-character input.
3. Google OAuth state expiry relied only on cookie expiry. Expiry is now signed
   and checked on the server, and malformed repeated query parameters are safe.
4. Matching email addresses automatically merged Google identities with password
   accounts whose email ownership was never verified. Removed automatic merging.
   Existing Google-subject matches still sign in; collisions must use the existing
   sign-in method. An explicit authenticated account-linking flow is future scope.
5. Credential and user responses were cacheable. API responses now default to
   `Cache-Control: private, no-store`, including Google token handoff and errors.
6. Password resets used a read-then-save sequence, allowing concurrent reuse.
   Token consumption, expiry check, password replacement, and version increment
   now occur in one database operation. Password change and logout also rotate
   versions atomically; password changes clear outstanding reset links.
7. Concurrent profile replacements could select the wrong old image for cleanup.
   The update now returns the previous image atomically.
8. Failed newsletter confirmations could never be retried once the subscriber
   existed. New subscribers now have per-email delivery status and an expiring
   claim; re-submission retries missing emails and skips recorded successes.
9. Resend requests lacked a timeout and logged raw error objects. Requests now
   have a 10-second bound and sanitized error logging.
10. Configuration permitted insecure production frontend URLs and invalid or
    mismatched Google callback URLs. Validation now enforces production HTTPS and
    the same-origin `/api/auth/google/callback` path.
11. Optional settings in `.env.example` were populated with invalid/fake values,
    causing avoidable startup errors. Optional providers are blank until configured.
12. Production compilation included test/config files, moving the entry point into
    `dist/src/main.js`. Build scope now includes only application source and emits
    `dist/main.js`. Type checking still covers tests; compiler caches are Git-ignored. The build cache
    now lives inside `dist/` so output cleanup cannot leave a stale cache that
    suppresses emission on the next build.

## Verification evidence and limits

- Baseline: 19 Jest suites, 155 tests passed.
- Final backend tests: **21 Jest suites / 177 tests passed** (`npm test -- --silent`).
- TypeScript check and Nest production build passed (`npm run check`). The build
  cache location was then corrected; both a fresh build and a repeated build
  emitted `dist/main.js`. The compiled entry point started successfully on temporary
  audit port 5102, and `/api/health` and `/contact.html` returned HTTP 200.
- Existing map/location Playwright checks: **2 passed in installed Chrome** against
  the compiled backend on port 5102. Verified company marker, optional visitor
  location/distance, directions URL, and denied-permission fallback. The initial
  browser attempt targeted an unavailable local server; rerunning against the
  verified compiled server passed.
- `git diff --check`: passed. No frontend files were edited during this audit.
- `npm audit --json`: 0 known vulnerabilities across 664 dependencies.
- MongoDB: live read-only ping succeeded. Inspected indexes: unique user email,
  sparse unique Google ID, unique newsletter email. No test customers/messages
  were inserted into the configured store database.
- Cloudinary: live authenticated read-only ping returned `ok`. No upload/delete
  against the real cloud was performed.
- Secrets: scanned 533 reachable Git text blobs against configured private values
  and common credential patterns; no matches. Also scanned 176 current source/config
  files (including untracked audit changes); no matches. Tracked environment files are only
  the two `.env.example` files. This scoped scan cannot certify absence of every
  possible secret or secrets on remote/unreachable history not present locally.
- A standalone lint script/configuration does not exist. TypeScript checking and
  `git diff --check` are used; this is not a claim that ESLint ran.
- Full storefront/payment Playwright E2E is not run: `Backend/e2e/.env` is absent.
  That suite requires an isolated `E2E_MONGO_URL`, Stripe test credentials, and a
  browser; it creates users/products/orders/payments and must not target store data.
- SMTP acceptance, inbox delivery, real Google consent/code exchange, and live
  upload roundtrips remain external acceptance checks. No email was sent by this audit.

## Environment variables you need

Your current local `Backend/.env` has MongoDB, JWT, Cloudinary, Stripe and frontend
settings. The frontend URL agrees with local port **5001**. SMTP, Google OAuth,
Resend settings, and explicit NODE_ENV are absent. Values were not printed.

| Group | Variables | Action |
| --- | --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `FRONTEND_URL` | Use `development`, `5001`, `http://localhost:5001` locally; production needs `NODE_ENV=production` and canonical HTTPS frontend origin |
| Database | `MONGO_URL` | Present, live ping passed; use a least-privilege database user and appropriate Atlas network access |
| JWT | `JWT_SECRET` | Present; production requires a separate random secret of at least 32 characters |
| Uploads | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Present, credential ping passed; configure separately on hosting |
| Contact/newsletter email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Missing. Configure host, username, password, sender together; use port 587/secure=false for STARTTLS or 465/secure=true for implicit TLS |
| Email display/routing | `SMTP_FROM_NAME`, `CONTACT_RECIPIENT_EMAIL` | Optional; recipient defaults to SMTP_FROM. Set the company's inbox to receive notifications |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Missing; configure all three. Local redirect must be `http://localhost:5001/api/auth/google/callback` |
| Password-reset email | `RESEND_API_KEY`, `EMAIL_FROM` | Missing; configure together. SMTP does not currently replace this separate provider |
| Payments required by current app startup | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Present; retain valid test settings during development, even when working only on auth/contact |
| Reverse proxy | `TRUST_PROXY` | Configure only for known hosting proxy hops; do not trust arbitrary forwarded IPs |
| Disposable browser tests | `E2E_MONGO_URL`, optionally `E2E_PORT`, `E2E_BASE_URL`, `E2E_RUN_STRIPE` | Configure in ignored `Backend/e2e/.env` before the full storefront suite |
| Map | None | Leaflet/OpenStreetMap and external Google Maps URLs require no API key |

Keep private values in ignored local environment files and hosting secret settings.
Restart/redeploy after changing them. Do not place them in frontend files, Git, or
screenshots. No secrets were changed or committed during the audit.

## External accounts and setup

### Google Sign-In

Create a Google Cloud project; configure the OAuth consent/branding and test users
while in testing mode. Create an OAuth client of type **Web application**. Register
`http://localhost:5001/api/auth/google/callback` as an authorized redirect URI,
and add the exact HTTPS production callback when deploying. Copy the client ID,
client secret and matching redirect URI into the three backend variables. The
server flow requests only `openid email profile`; it does not require a Google
Maps API or Gmail API. Follow [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

### Nodemailer / company mailbox

Use an SMTP provider account and an authorized sender. For a student Gmail setup,
enable 2-Step Verification and create a dedicated App Password where available.
Use `smtp.gmail.com`, port `587`, `SMTP_SECURE=false`; put the mailbox address in
SMTP_USER and SMTP_FROM, and the App Password in SMTP_PASSWORD. Set the recipient
to the company's inbox. Regular account passwords are not the configuration for
this flow. See [Nodemailer's Gmail guide](https://nodemailer.com/guides/using-gmail).
Provider quotas and spam filtering still apply; SMTP success cannot guarantee inbox placement.

### Cloudinary, MongoDB, and recovery mail

Existing Cloudinary and MongoDB credentials were accepted by read-only probes.
Cloudinary uses the product environment's cloud name and API credentials from its
console ([Node integration](https://cloudinary.com/documentation/node_integration)).
For password recovery, create a Resend account, verify a sending domain using its
DNS records, create a sending key, and set EMAIL_FROM to a sender on that domain
([domain setup](https://resend.com/docs/dashboard/domains/introduction)). Production
recovery intentionally returns a generic response without exposing reset links
when Resend is not configured.

## Frontend connection contract

- Signup/login: send JSON; successful signup returns 201, login 200, both with
  `{ accessToken, user }`. Send `Authorization: Bearer ...` to protected endpoints.
  Handle 400 validation/credential errors, 401 expired/revoked sessions, 403 role
  failures, and 429 limits. Reauthenticate after logout or password change.
- Google: navigate to `/api/auth/google?next=/account.html`. The backend redirects
  through Google to `/oauth-callback.html`; fetch `/api/auth/google/session` on the
  same origin to obtain the normal auth response. Handle `error=cancelled|failed`.
- Contact: JSON `{name,email,message}` to `/api/contact`. A 503 may explicitly say
  the message was saved but mail failed; do not blindly auto-submit duplicate messages.
- Newsletter: JSON `{email}` to `/api/newsletter`. A successful existing subscription
  is idempotent. After an email failure, a later explicit re-submission retries delivery.
- Profile picture: authenticated PATCH multipart FormData with only `image`; let
  the browser set the multipart boundary. Response is `{profileImageUrl}`. Surface
  file validation/size errors. Do not submit a user ID or Cloudinary credentials.
- Map/location: no API connection is needed. The existing optional geolocation
  action calculates straight-line distance locally; road directions open an external
  site. Keep the company map available even without location permission.

## Remaining work and operational limits

No known blocking code defect remains in the audited scope after the listed fixes
and verification. Configuration and provider acceptance tests above remain required
before claiming these features work end to end. They do not require a frontend redesign.

Additional limits: registration has no mailbox verification; Google account linking
requires a future authenticated flow; newsletter confirmation is not double opt-in
and there is no campaign sender or public unsubscribe flow. Do not treat the stored
list as a production marketing platform. Existing legacy subscribers are not
retroactively emailed. Newsletter retries are request-driven, not a background
queue; a crash after SMTP acceptance but before saving status can still duplicate
mail on retry. Contact email failures remain saved records for company review;
there is no automatic contact-email retry queue. Cloudinary cleanup is best-effort.

Rate limiting uses process-local storage. It is tested for this single-instance
student setup; multiple instances/serverless deployment need shared limiting or an
edge policy before relying on these limits for public abuse protection. The demo
business address and map-provider usage/attribution terms must be reviewed before
launch. These are deployment/scope considerations, not new frontend work performed here.
