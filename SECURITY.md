## PopClozet Security Architecture

This document describes how the PopClozet monorepo implements the multi‑layer security model you outlined (network, identity, data, app logic, mobile, supply‑chain, and monitoring).

The stack is:
- **Frontend apps**: `apps/customer-app`, `apps/rider-app` (Vite + React, PWA for customer)
- **Shared backend**: Supabase (Postgres + GoTrue Auth + Realtime + Storage)
- **Shared client**: `@popclozet/api-client` + `@popclozet/auth` packages

---

## 1. Network & Edge Security (Level 1)

These controls are applied at deployment/infra time:

- **TLS 1.3 + HSTS**
  - Terminate TLS at Cloudflare / your edge (or equivalent): force HTTPS and enable HSTS with a long `max-age` and `includeSubDomains`.
  - Ensure all app origins (customer & rider) are only served over HTTPS.
- **WAF + DDoS Protection**
  - Place the customer and rider app domains behind Cloudflare/AWS WAF.
  - Enable OWASP rulesets (SQLi, XSS, LFI/RFI, command injection, etc.).
  - Turn on DDoS protection for HTTP(S) endpoints and Supabase REST RPC routes.
- **Geo‑Blocking & Honeypots**
  - WAF rules to:
    - Block or challenge traffic from countries where the service does not operate.
    - Add honeypot paths (e.g. `/admin/login.php`, `/phpmyadmin`) that immediately ban or rate‑limit IPs when accessed.

> All of the above are infra‑side; the repo assumes a secure edge and documents what to enable but does not hard‑code provider specifics.

---

## 2. Frontend Security (CSP, PWA, Session Handling)

### 2.1 Content Security Policy (CSP)

- **Customer App** (`apps/customer-app/index.html`)
  - Enforces a CSP that:
    - Restricts scripts to first‑party only (`script-src 'self' 'unsafe-inline'`).
    - Restricts styles/fonts to first‑party + Google Fonts.
    - Restricts images and network calls to:
      - `https://*.supabase.co`
      - `https://api.mapbox.com`
      - `https://events.mapbox.com`
    - Framing protection is enforced via the `X-Frame-Options: SAMEORIGIN` HTTP header in `vercel.json` (note: `frame-ancestors` is not valid in `<meta>` CSP tags).
- **Rider App** (`apps/rider-app/index.html`)
  - Similar CSP with `script-src 'self' 'unsafe-inline'` (required for Vite dev server HMR injection).

These CSPs:
- Block most XSS payloads from loading third‑party JS.
- Prevent data exfiltration to arbitrary domains.
- Constrain where fonts, images, and API calls can go.

### 2.2 PWA Hardening (Customer App)

- Service worker via `vite-plugin-pwa`:
  - Caches only specific asset types and known external origins.
  - Uses `NetworkFirst` caching for Supabase REST APIs with short TTLs.
  - Uses `CacheFirst` caching for static images and Mapbox tiles.
- App served in **standalone** display mode with a restrictive `scope` and `start_url`.

### 2.3 Session Handling & Auth Flows

- **Supabase client** is centralized in `@popclozet/api-client`:
  - Uses Supabase JS v2 with automatic token refresh and PKCE/OAuth callback support.
  - All apps consume this single client – they do **not** create ad‑hoc clients with hard‑coded keys.
- **Customer Auth**:
  - `SupabaseAuthProvider` (`apps/customer-app/src/context/SupabaseAuthContext.tsx`) provides:
    - SMS OTP auth (`signInWithOtp` / `verifyOtp`).
    - Google OAuth (`signInWithOAuth`) with explicit `redirectTo` and URL cleanup.
    - Profile bootstrap + onboarding flag (`needsOnboarding`) so incomplete profiles cannot fully use the app.
  - `AuthGate` protects routes and handles:
    - Public route allow‑list.
    - Redirect to `/signin` for anonymous users.
    - Force onboarding flow at `/auth/create-account` for new users.
- **Rider Auth**:
  - `@popclozet/auth` package exposes `AuthProvider` and `useAuth` for the rider app.
  - Rider `App.tsx`:
    - Shows only `/login` + `/signup` routes when unauthenticated.
    - Blocks non‑rider roles with a **blocking screen** (`WrongRoleScreen`), not a redirect.

> Long‑lived cookie‑based refresh tokens and strict MFA enforcement are configured in Supabase auth settings (GoTrue) at the project level; this repo expects those to be enabled as per your environment.

---

## 3. Identity & Authorization (Levels 2–3)

### 3.1 Roles & Permissions

- **Profiles + Roles**
  - `profiles` table in Supabase stores the `role` field (`customer`, `rider`, `warehouse`, `admin`).
  - `@popclozet/domain-contracts` defines the role and permission enums used by apps.
- **Role‑based Frontend Logic**
  - `useRolePermissions` hook (legacy app) centralizes allowed actions per role (view orders, mutate statuses, access admin views, etc.).
  - Rider app checks `profile.role` and blocks mismatched roles entirely.

### 3.2 Row‑Level Security (RLS) & RBAC in Supabase

Supabase migrations under `supabase/migrations` implement RLS and role policies:

- **Rider Telemetry** (`20260122_rider_location_rls.sql`)
  - Riders can only insert/update their own `rider_locations` rows and only if their `profiles.role = 'rider'`.
- **Order State Machine & No Direct Status Updates**
  - `20260122_order_state_machine.sql` and `20260122_no_direct_status_update.sql`:
    - Enforce all order status changes through `transition_order_state(..)` SECURITY DEFINER function.
    - Guard transitions by `actor_role` and ensure the actor owns the order (customer) or is the assigned rider.
- **Admin‑only Audit & Incident Log**
  - `20260123_audit_log.sql` and `20260123_audit_trigger.sql`:
    - `order_audit_log` is append‑only, RLS‑protected, and visible only to admins.
    - `incident_log` tracks suspicious patterns and is also admin‑only.

These policies ensure:
- Customers only ever see their own data.
- Riders only see/modify orders explicitly assigned to them.
- Admins get observability but cannot silently tamper with history.

---

## 4. Application Logic Security (Level 4)

### 4.1 Order State Machine (Server‑Side Guard Rails)

- All state transitions for `orders` go through `transition_order_state` (Supabase RPC).
- The function:
  - Validates ownership (`NOT_ORDER_OWNER`, `RIDER_NOT_ASSIGNED`).
  - Enforces a finite set of allowed transitions per role.
  - Enforces admin **read‑only** semantics (admins cannot mutate order state).
  - Locks rows with `FOR UPDATE` to avoid race conditions.

### 4.2 Telemetry‑Aware Auditing & Incidents

- Each call to `transition_order_state`:
  - Logs a full JSON result into `order_audit_log`.
  - For rider transitions, captures latest telemetry snapshot and confidence score from `rider_locations`.
  - Emits incidents into `incident_log` when confidence is low, without blocking the workflow.

This provides:
- Tamper‑evident history for all order changes.
- A substrate for anomaly detection (Level 7) by querying `incident_log` and confidence scores.

### 4.3 Rider & Customer Flows

- **Rider app** (`apps/rider-app`):
  - Uses `riderOrderService` and Supabase RPCs (e.g., `complete_delivery`, `out_for_delivery`) instead of direct SQL updates.
  - Updates rider location via `updateRiderLocation`, which is constrained by RLS.
- **Customer app**:
  - Uses services in `apps/customer-app/src/services` that call Supabase through `@popclozet/api-client`, never bypassing RLS or the state machine.

---

## 5. Data Protection (Encryption & PII Hygiene)

Supabase provides:
- **Encryption at rest** for Postgres and Storage (AES-256 on disk managed by the provider).
- **TLS in transit** for all `https://*.supabase.co` and `wss://*.supabase.co` endpoints.

Within the app:
- Sensitive environment variables (Supabase keys, Mapbox token) are stored only in `.env` files and ignored via `.gitignore`.
- Logs and console output in the app avoid printing secrets or raw tokens.

### 5.1 Field-Level PII Encryption (Implemented)

- Migration `supabase/migrations/20260227_pii_encryption.sql` enables `pgcrypto` and provides:
  - `encrypt_pii(plaintext)` - encrypts using PGP symmetric encryption with a key stored in Supabase Vault.
  - `decrypt_pii(ciphertext)` - decrypts back to plaintext, also using the vault key.
  - Encrypted `phone_encrypted` and `email_encrypted` columns on the `profiles` table.
- **Setup required**: run `supabase secrets set PII_ENCRYPTION_KEY=<your-key>` before applying the migration.
- After backfilling, the plaintext `phone`/`email` columns can be dropped.

---

## 6. Mobile / Client Hardening (Level 5)

Because the current clients are **web/PWA** apps, some native‑only protections (SSL pinning, jailbreak detection, native screenshot blocking) are not technically possible here.

However, the design anticipates:
- Wrapping the PWA in a native shell (e.g., Capacitor/React Native) for:
  - SSL pinning.
  - Root/jailbreak checks.
  - Screen capture prevention on payment/OTP screens.
- Enabling biometric auth (FaceID/TouchID) for sensitive actions via native wrappers.

> When you introduce native wrappers, implement these controls in the native layer while continuing to use the same Supabase/state‑machine backend.

---

## 7. Supply Chain & CI/CD Security (Level 6)

Fully implemented in `.github/workflows/security.yml` with 4 parallel jobs:

- **Dependency Audit** (`dependency-audit`)
  - Runs `pnpm audit --audit-level=high` (warning) and `--audit-level=critical` (failing).
  - Triggers on push to `main`/`develop`, every PR, and nightly at 3 AM UTC.
- **Secret Scanning** (`secret-scan`)
  - Uses TruffleHog to scan full git history for verified leaked secrets.
- **Lint & Type Check** (`lint-and-typecheck`)
  - Runs ESLint on the customer app and `tsc --noEmit` on both apps.
- **License Compliance** (`license-check`)
  - Validates all production dependencies use approved open-source licenses.
- **Secret Storage**
  - `.gitignore` excludes `.env`, `.env.local`, `.env.production`.
  - Snyk integration pre-configured (commented) – add `SNYK_TOKEN` secret to enable.
- **Immutable Builds**
  - Built artifacts are immutable; patching requires a new build from VCS.

---

## 8. Monitoring, Alerts & Incident Response (Level 7)

### 8.1 Automated Alerting Pipeline (Implemented)

Migration `supabase/migrations/20260227_incident_alerting.sql` provides:

- **`alert_queue` table** – stores actionable alerts with severity, acknowledgement tracking. Admin-only via RLS.
- **Auto-alert trigger** (`trg_auto_alert`) – automatically creates an alert on `high`/`critical` incidents.
- **Brute-force detection** (`detect_suspicious_login_patterns(interval, threshold)`) – finds users with repeated failures within a window. Callable via pg_cron or Edge Function.
- **Daily summary view** (`incident_daily_summary`) – aggregates incidents by day/severity/type for dashboards.

### 8.2 HSTS & Security Headers (Implemented)

`vercel.json` configures HTTP response headers for production:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(self), fullscreen=(self)`

### 8.3 Severity Levels

- **Level 1 – Critical**: Data breach/credential compromise. Lock keys, revoke tokens.
- **Level 2 – High**: Active attack/DDoS. Enable WAF "Under Attack" mode.
- **Level 3 – Medium**: Suspicious activity. Force password resets, investigate.
- **Level 4 – Low**: Noise/monitoring only.

---

## 9. How to Operate This Safely

- **Never bypass the state machine**:
  - Always use `transition_order_state` or the provided RPC helpers (`complete_delivery`, `out_for_delivery`, etc.).
- **Never disable RLS in production**:
  - All migrations assume `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` remains in place.
- **Keep secrets in `.env` only**:
  - Configure Supabase, Mapbox, and any payment providers via environment variables or your secret manager (Infisical/Doppler/etc.).
- **Run security CI regularly**:
  - Ensure the dependency/secret scanning workflow runs on every PR and on a nightly schedule.

With these pieces in place, the system implements the layered “strong wall” architecture you described:
- **Identity**: Supabase auth with roles, OTP, and onboarding.
- **App**: Centralized clients, CSP, PWA hardening, and guarded flows.
- **Network**: WAF/TLS/HSTS/Geo‑blocking at the edge (documented here, enforced in infra).
- **Data**: RLS on all critical tables, immutable audit logs, and incident tracking.
- **Ops**: CI hooks and an incident model that can drive alerting and response.

