# popclozet — Complete Security Architecture (Implemented)

> **56 security features** across 10 layers. Every item below is implemented in this repository.

---

## 1. Network & Edge Security (Level 1)

| # | Feature | File | Status |
|---|---|---|---|
| 1 | **HSTS** (2-year max-age + preload) | `vercel.json` | ✅ Implemented |
| 2 | **X-Frame-Options** (SAMEORIGIN) | `vercel.json` | ✅ Implemented |
| 3 | **X-Content-Type-Options** (nosniff) | `vercel.json` | ✅ Implemented |
| 4 | **X-XSS-Protection** (1; mode=block) | `vercel.json` | ✅ Implemented |
| 5 | **Referrer-Policy** (strict-origin-when-cross-origin) | `vercel.json` | ✅ Implemented |
| 6 | **Permissions-Policy** (block camera, mic) | `vercel.json` | ✅ Implemented |
| 7 | **Cloudflare Worker Rate Limiter** (100 API / 10 auth per min per IP) | `cloudflare/worker.ts` | ✅ Implemented |
| 8 | **Geo-Blocking** (IN, US, UK, AE, SG only) | `cloudflare/worker.ts` | ✅ Implemented |
| 9 | **Honeypot Traps** (`/wp-admin`, `/.env`, `/phpmyadmin` → instant 24h IP ban) | `cloudflare/worker.ts` | ✅ Implemented |
| 10 | **DDoS Protection** (Cloudflare Worker + KV rate store) | `cloudflare/worker.ts` | ✅ Implemented |

**Deployment:** `cloudflare/wrangler.toml` configures the Worker. Run `wrangler deploy` to activate.

---

## 2. Frontend Security (Level 2)

### 2.1 Content Security Policy (CSP)

| # | Feature | File | Status |
|---|---|---|---|
| 11 | **Customer App CSP** — restricts scripts/styles/images/connect to self + Supabase + Mapbox + Google Fonts | `apps/customer-app/index.html` | ✅ Implemented |
| 12 | **Rider App CSP** — same restrictions for rider app | `apps/rider-app/index.html` | ✅ Implemented |

Both CSPs enforce:
- `script-src 'self' 'unsafe-inline'` — blocks third-party scripts
- `connect-src 'self' https://*.supabase.co https://api.mapbox.com` — blocks data exfiltration
- `base-uri 'self'` + `form-action 'self'` — prevents base tag hijacking

### 2.2 PWA Hardening

| # | Feature | File | Status |
|---|---|---|---|
| 13 | **Service Worker** (NetworkFirst for APIs, CacheFirst for assets) | `apps/customer-app/vite.config.ts` | ✅ Implemented |
| 14 | **Standalone mode** with restricted `scope` and `start_url` | `apps/customer-app/vite.config.ts` | ✅ Implemented |

---

## 3. Authentication & Identity (Level 3)

| # | Feature | File | Status |
|---|---|---|---|
| 15 | **SMS OTP Authentication** | `apps/customer-app/src/context/SupabaseAuthContext.tsx` | ✅ Implemented |
| 16 | **Google OAuth** (with explicit `redirectTo` + URL cleanup) | `SupabaseAuthContext.tsx` | ✅ Implemented |
| 17 | **AuthGate** (route protection, redirect to `/signin`) | `apps/customer-app/src/components/auth/AuthGate.tsx` | ✅ Implemented |
| 18 | **WrongRoleScreen** (blocks non-riders with blocking screen) | `apps/rider-app/src/App.tsx` | ✅ Implemented |
| 19 | **Profile Onboarding Gate** (`needsOnboarding` flag) | `SupabaseAuthContext.tsx` | ✅ Implemented |
| 20 | **Login Rate Limiting** (5 failures / 15 min → 30 min lockout) | `supabase/migrations/20260227_security_hardening.sql` | ✅ Implemented |
| 21 | **hCaptcha Bot Detection** (dynamic script loading, server verification) | `packages/auth/src/captcha.ts` | ✅ Implemented |
| 22 | **Device Fingerprinting** (new-device MFA trigger, 5 known devices) | `packages/auth/src/sessionHelper.ts` | ✅ Implemented |
| 23 | **Password Policy** (12+ chars, uppercase, lowercase, number, symbol) | `packages/domain-contracts/src/validation.ts` | ✅ Implemented |
| 24 | **Anti-Enumeration** (always same response on login, hides user existence) | `supabase/migrations/20260227_anti_enumeration.sql` | ✅ Implemented |
| 25 | **Account Suspension** (`suspend_account()` with reason tracking) | `20260227_anti_enumeration.sql` | ✅ Implemented |
| 26 | **CSRF Protection** (double-submit tokens, constant-time comparison) | `packages/auth/src/csrfProtection.ts` | ✅ Implemented |
| 27 | **Open Redirect Prevention** (domain whitelist for redirects) | `packages/auth/src/redirectProtection.ts` | ✅ Implemented |
| 28 | **MFA (TOTP)** — enroll authenticator app, verify codes, assurance levels | `packages/auth/src/mfaService.ts` | ✅ Implemented |
| 29 | **Centralized Supabase Client** (single client, no ad-hoc keys) | `packages/api-client/src/index.ts` | ✅ Implemented |

---

## 4. Authorization & Data Security (Level 4)

| # | Feature | File | Status |
|---|---|---|---|
| 30 | **Row Level Security (RLS)** on all critical tables | Multiple SQL migrations | ✅ Implemented |
| 31 | **RBAC** (customer, rider, warehouse, admin roles) | `src/hooks/useRolePermissions.ts` | ✅ Implemented |
| 32 | **PII Encryption** (pgcrypto PGP symmetric, Vault key management) | `supabase/migrations/20260227_pii_encryption.sql` | ✅ Implemented |
| 33 | **Input Validation** (Zod schemas for ALL fields: phone, OTP, email, address, orders, payments) | `packages/domain-contracts/src/validation.ts` | ✅ Implemented |
| 34 | **XSS Sanitizer** (HTML escaping, tag stripping, URL sanitization, SQL wildcard escaping) | `packages/domain-contracts/src/xssSanitizer.ts` | ✅ Implemented |
| 35 | **Error Sanitizer** (maps internal DB errors to safe user messages, blocks stack trace leakage) | `packages/domain-contracts/src/errorSanitizer.ts` | ✅ Implemented |

---

## 5. Application Logic Security (Level 5)

| # | Feature | File | Status |
|---|---|---|---|
| 36 | **Order State Machine** (all transitions via `transition_order_state()` RPC) | `supabase/migrations/20260122_order_state_machine.sql` | ✅ Implemented |
| 37 | **No Direct Status Updates** (trigger blocks raw UPDATE on orders.status) | `supabase/migrations/20260122_no_direct_status_update.sql` | ✅ Implemented |
| 38 | **Idempotency Keys** (prevents duplicate orders/payments, 24h cache) | `supabase/migrations/20260227_security_hardening.sql` | ✅ Implemented |
| 39 | **Webhook Signature Verification** (HMAC-SHA256 via Supabase Vault) | `20260227_security_hardening.sql` | ✅ Implemented |
| 40 | **API Rate Limiting** (per-user/endpoint, configurable window) | `20260227_security_hardening.sql` | ✅ Implemented |
| 41 | **OTP for Delivery/Returns** (rider + customer must exchange codes) | `supabase/migrations/20260118_initial_schema.sql` | ✅ Implemented |
| 42 | **Ephemeral Rider Data** (contact visible ONLY during active delivery) | `20260227_security_hardening.sql` | ✅ Implemented |
| 43 | **Non-Sequential Order IDs** (format `PC-YYMMDD-XXXX`, prevents guessing) | `20260227_anti_enumeration.sql` | ✅ Implemented |
| 44 | **Payment Service** (Razorpay PCI-DSS compliant, card data never touches server) | `packages/api-client/src/paymentService.ts` | ✅ Implemented |

---

## 6. Mobile / Client Hardening (Level 6)

| # | Feature | File | Status |
|---|---|---|---|
| 45 | **Capacitor Native Wrapper Config** (SSL pinning, Android/iOS security) | `capacitor.config.ts` | ✅ Implemented |
| 46 | **Screenshot Prevention** (native FLAG_SECURE + CSS print blocker fallback) | `packages/auth/src/nativeSecurity.ts` | ✅ Implemented |
| 47 | **Biometric Auth** (FaceID/TouchID for sensitive actions) | `packages/auth/src/nativeSecurity.ts` | ✅ Implemented |
| 48 | **Root/Jailbreak Detection** (blocks compromised devices) | `packages/auth/src/nativeSecurity.ts` | ✅ Implemented |
| 49 | **Secure Clipboard** (auto-clears copied OTPs after 30 seconds) | `packages/auth/src/nativeSecurity.ts` | ✅ Implemented |

> These features use the Capacitor plugin API and gracefully degrade to no-ops in PWA/browser mode.

---

## 7. Monitoring, Alerts & Incident Response (Level 7)

| # | Feature | File | Status |
|---|---|---|---|
| 50 | **Immutable Audit Log** (append-only, admin-only, all state transitions) | `supabase/migrations/20260123_audit_log.sql` | ✅ Implemented |
| 51 | **Incident Log** (tracks suspicious patterns, low-confidence telemetry) | `20260227_incident_alerting.sql` | ✅ Implemented |
| 52 | **Auto-Alert Trigger** (auto-creates alerts on high/critical incidents) | `20260227_incident_alerting.sql` | ✅ Implemented |
| 53 | **Brute-Force Detection** (`detect_suspicious_patterns()` function) | `20260227_incident_alerting.sql` | ✅ Implemented |
| 54 | **Daily Incident Summary** (aggregated view for dashboards) | `20260227_incident_alerting.sql` | ✅ Implemented |
| 55 | **Log Sanitizer** (auto-redacts phone, email, JWT, API keys, CC, OTP from production logs) | `packages/auth/src/logSanitizer.ts` | ✅ Implemented |

### Severity Levels

- **Level 1 — Critical**: Data breach / credential compromise → Lock keys, revoke tokens
- **Level 2 — High**: Active attack / DDoS → WAF "Under Attack" mode
- **Level 3 — Medium**: Suspicious activity → Force password resets, investigate
- **Level 4 — Low**: Noise / monitoring only

---

## 8. Supply Chain & CI/CD Security (Level 8)

| # | Feature | File | Status |
|---|---|---|---|
| 56 | **Dependency Audit** (`pnpm audit` — warn on high, fail on critical) | `.github/workflows/security.yml` | ✅ Implemented |
| 57 | **Secret Scanning** (TruffleHog full git history scan) | `.github/workflows/security.yml` | ✅ Implemented |
| 58 | **License Compliance** (validates approved OSS licenses) | `.github/workflows/security.yml` | ✅ Implemented |
| 59 | **Type Checking** (`tsc --noEmit` on both apps) | `.github/workflows/security.yml` | ✅ Implemented |
| 60 | **Pre-Commit Hook** (blocks commits with leaked secrets/.env files) | `.husky/pre-commit` | ✅ Implemented |
| 61 | **Dependabot** (weekly automated vulnerability scanning) | `.github/dependabot.yml` | ✅ Implemented |
| 62 | **Vulnerability Disclosure Policy** | `.github/SECURITY.md` | ✅ Implemented |
| 63 | **`.gitignore` Secrets** (`.env`, `.env.local`, `.env.production` excluded) | `.gitignore` | ✅ Implemented |

---

## 9. Data Compliance — GDPR/CCPA (Level 9)

| # | Feature | File | Status |
|---|---|---|---|
| 64 | **Data Retention Policy** (auto-delete: login attempts 30d, rate limits 7d, idempotency 24h, alerts 90d) | `20260227_anti_enumeration.sql` | ✅ Implemented |
| 65 | **PII Access Control** (RLS: only user can read own decrypted PII) | `20260227_pii_encryption.sql` | ✅ Implemented |

---

## 10. How to Operate This Safely

- **Never bypass the state machine**: Always use `transition_order_state` or RPC helpers.
- **Never disable RLS in production**: All migrations enforce `ENABLE ROW LEVEL SECURITY`.
- **Keep secrets in `.env` only**: Configure via environment variables or Supabase Vault.
- **Run security CI regularly**: The pipeline runs on every push/PR and nightly at 3 AM UTC.
- **Deploy Cloudflare Worker**: Run `wrangler deploy` from the `cloudflare/` directory.
- **Apply SQL migrations**: Run all `20260227_*.sql` files in your Supabase SQL editor.
- **Set Vault secrets**: `PII_ENCRYPTION_KEY`, `WEBHOOK_SECRET` in Supabase Vault.
- **Enable MFA**: Toggle in Supabase Dashboard → Auth → MFA settings.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER                        │
│   Rate Limiting │ Geo-Blocking │ Honeypots │ DDoS Shield    │
├─────────────────────────────────────────────────────────────┤
│                    VERCEL HEADERS                           │
│   HSTS │ X-Frame │ nosniff │ XSS │ Referrer │ Permissions  │
├─────────────────────────────────────────────────────────────┤
│                  FRONTEND (React PWA)                       │
│   CSP │ Captcha │ CSRF │ XSS Sanitizer │ Redirect Guard    │
├─────────────────────────────────────────────────────────────┤
│                  AUTHENTICATION                             │
│   OTP │ OAuth │ MFA/TOTP │ Rate Limit │ Device Fingerprint  │
│   Password Policy │ Anti-Enumeration │ Account Suspension   │
├─────────────────────────────────────────────────────────────┤
│                  AUTHORIZATION                              │
│   RLS │ RBAC │ AuthGate │ WrongRoleScreen │ Onboarding Gate │
├─────────────────────────────────────────────────────────────┤
│                  APPLICATION LOGIC                          │
│   State Machine │ Idempotency │ Webhooks │ Ephemeral Data   │
│   OTP Delivery │ Payments (PCI-DSS) │ Error Sanitizer       │
├─────────────────────────────────────────────────────────────┤
│                  DATA PROTECTION                            │
│   PII Encryption │ Zod Validation │ Input Sanitization      │
├─────────────────────────────────────────────────────────────┤
│                  MONITORING                                 │
│   Audit Log │ Incident Log │ Auto-Alerts │ Log Sanitizer    │
├─────────────────────────────────────────────────────────────┤
│                  CI/CD & SUPPLY CHAIN                       │
│   pnpm audit │ TruffleHog │ Dependabot │ Husky │ Licenses  │
├─────────────────────────────────────────────────────────────┤
│                  MOBILE HARDENING                           │
│   SSL Pinning │ Biometrics │ Root Detection │ Screen Guard  │
├─────────────────────────────────────────────────────────────┤
│                  COMPLIANCE                                 │
│   GDPR Data Retention │ PII Access Control │ PCI-DSS        │
└─────────────────────────────────────────────────────────────┘
```

> **65 security features** implemented across 10 defence layers.
> Zero Trust architecture: we assume the network is hostile, the device may be compromised, and the user may be malicious.
