# Password, coupon UI, and localhost session verification

Changes are limited to the three requested areas. No production credentials or data were changed, and no commit or push was made.

## Localhost OAuth finding

The local configuration uses port 5001, `FRONTEND_URL=http://localhost:5001/`, and `GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/api/auth/google/callback`. Development is the default NODE_ENV. The application serves frontend and API from one origin, uses relative `/api` requests with same-origin credentials, and does not need cross-origin CORS for this setup. The refresh cookie is host-only, HttpOnly, SameSite=Lax, scoped to `/api/auth`, and non-Secure only for local HTTP. Configuration and cookie flags required no changes.

The callback page loads `header.js`, which begins a refresh, and separately loads `oauth-callback.js`, which exchanges the Google handoff cookie and immediately navigated. If the refresh token was rotated in the database but its response had not reached the browser, navigation could abort that response. The next page would then send the old cookie; replay protection would revoke the refresh family and the guard would return the user to sign-in. This is a timing race that can affect the shared code, even when production timing does not expose it.

The new regression test failed against the original callback because it navigated while refresh was pending. The fix awaits the existing shared `refreshAccessToken()` promise before navigating and requires it to succeed. No artificial delay, guard bypass, storage token, backend OAuth change, or cookie-security change was added.

## Password policy

Signup, password change, and password reset now share a backend `StrongPassword` decorator requiring at least eight characters, an uppercase letter, a lowercase letter, a number, and a punctuation/symbol character. Bcrypt's existing 72 UTF-8 byte limit remains enforced. Passwords are not trimmed. Existing login passwords are not subjected to the new creation policy.

The three frontend pages load one password helper. It renders only missing requirements, updates immediately on input, removes each satisfied requirement, and hides the list when valid. Native validity and submission checks prevent weak submissions; backend validation remains authoritative. Tests compare frontend and backend missing messages across all three DTOs, including Unicode and byte-limit cases.

## Coupon UI and functionality

The coupon editor now has a 760px maximum width, a dedicated code/input/generation group, a two-column details grid that stacks on small screens, consistent gaps, and a separate actions row. Other admin sections and coupon business logic are unchanged.

The isolated browser flow generates and creates a coupon with a saved 23% discount, applies it to a two-item $200 cart, verifies a $46 discount and $154 checkout total, then saves an order through the real controller/service and checks the same snapshot. It also sends a forged item price to confirm backend pricing remains authoritative and verifies that applying a coupon changes neither paid nor reserved usage.

## Running the browser verification

From `Backend`:

```text
node verification/local-flows.cjs
```

The runner starts a temporary localhost Nest server, uses real frontend pages, controllers, session service, user session operations, JWT guards, coupon service, and order pricing. Google identity and database persistence are isolated in-memory fixtures. It does not load `.env`, connect to MongoDB, or contact Google or Stripe. It uses installed Chrome/Edge or Playwright Chromium; `VERIFY_BROWSER_PATH` can select another Chromium executable.

The runner checks:

- OAuth handoff while a rotated-cookie response is deliberately held by the test, followed by account-page reload.
- Local HTTP refresh-cookie flags, logout revocation, cookie clearing, protected-page rejection after logout, and normal email/password login.
- Dynamic password messages on signup, reset, and account pages.
- Coupon generation/create/apply, backend-priced order snapshots, and desktop/mobile layout.

Screenshots are generated under the ignored `Backend/test-results/local-flows/` directory. Both desktop and 390px mobile layouts were visually inspected.

## Verification results

- Targeted tests: 63 passed, including policy parity and the reproduced OAuth regression.
- Full `npm test`: 258 passed across 29 suites; the existing optional MongoDB/browser suite has four skipped tests.
- JavaScript syntax and `git diff --check`: passed.
- Final `npm run check`: passed (TypeScript typecheck and Nest production build).
- Complete isolated localhost browser run: passed, including session restoration, reload, logout, normal login, all three password interfaces, and generated coupon pricing through the saved order.

The browser tests prove the local handoff, cookie, guard, and pricing behavior with controlled fixtures. A live Google consent round trip and live MongoDB/Stripe E2E run were not performed. No backend coupon issue was found and no coupon logic rewrite was needed. No account migration or forced re-login is introduced by these changes; only newly created/replaced passwords must satisfy the stronger policy.

## Files changed

- `Backend/src/auth/password-policy.ts`
- `Backend/src/auth/dto/register.dto.ts`
- `Backend/src/auth/dto/reset-password.dto.ts`
- `Backend/src/users/dto/change-password.dto.ts`
- `Backend/src/auth/password-policy.spec.ts`
- `Backend/src/auth/oauth-handoff.spec.ts`
- `Backend/src/auth/auth-validation.spec.ts`
- `Backend/src/api.integration.spec.ts`
- `Frontend/js/password-policy.js`
- `Frontend/js/register.js`
- `Frontend/js/reset-password.js`
- `Frontend/js/account.js`
- `Frontend/js/oauth-callback.js`
- `Frontend/register.html`
- `Frontend/reset-password.html`
- `Frontend/account.html`
- `Frontend/css/styles.css`
- `Frontend/admin/js/admin-coupons.js`
- `Frontend/admin/css/admin.css`
- `Backend/verification/local-flows.cjs`
- `Backend/verification/README.md`

Suggested commit: `fix: tighten password validation, OAuth handoff, and coupon UI`
# Final release polish coverage

The same isolated runner also verifies that signup requirements are hidden while
empty/untouched, show only missing rules after input (including `Testtest2`),
and appear on an invalid empty submission. Valid signup runs through the real
controller, validation, and password hashing with fixture persistence.

Mobile carousel checks dispatch Chromium touch gestures in both directions and
verify native vertical page scrolling. Coupon editor screenshots are generated
for desktop and mobile. These checks do not replace live Google consent,
MongoDB persistence, or Stripe test-mode payment verification.
