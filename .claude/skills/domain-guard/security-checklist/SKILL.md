---
name: security-checklist
description: Security checklist to apply whenever writing or reviewing code that touches payments, Stripe, authentication, admin routes, environment variables/secrets, or price calculation. Use before considering any task in these areas complete — payments, auth, admin guards, .env handling, pricing endpoints.
---

# Security Checklist — Areia Bela

This skill exists because the Fase 1 audit (`docs/current-analysis.md`) found several
concrete security failures in the original codebase: an exposed Stripe secret key in
`.env.backup`, an admin panel with no real authentication, and a checkout flow that
trusted a client-supplied total price. Don't let these patterns come back.

## Before marking any payments/auth/admin task done, verify:

### Secrets

- [ ] No credentials, API keys, or secrets are hardcoded anywhere in source files.
- [ ] No `.env*` file containing real secrets is committed to git (check `.gitignore`).
- [ ] Env vars are documented in `docs/env.md` by name only, never with real values.

### Pricing / payments

- [ ] The total charged to Stripe is always recalculated server-side from `Property`,
      `PriceRule`, `Extra`, and the requested dates/guests — never trusted from the
      request body or query params.
- [ ] Stripe webhooks verify the signature before processing any event.
- [ ] The `Booking` record is created from the webhook handler (after payment is
      confirmed), never optimistically from the frontend before payment completes.
- [ ] Webhook handling is idempotent (a retried webhook event doesn't double-book or
      double-charge).

### Authentication / admin

- [ ] `/admin/*` routes are protected by real middleware/guards, not just a redirect.
- [ ] No pre-filled or bypassable login form. No "always succeed" demo auth left in
      code, even temporarily, past the phase it was scaffolded in.
- [ ] Passwords are hashed with Argon2 (not stored in plaintext or weakly hashed).
- [ ] JWT access tokens are short-lived; refresh tokens are rotated on use.
- [ ] Session/auth cookies are `HttpOnly`, `Secure`, and `SameSite` appropriately set.
- [ ] Rate limiting / lockout exists on login and password-reset endpoints.

### General API hygiene

- [ ] All user input is validated server-side (not just client-side with Zod/RHF).
- [ ] Helmet, CORS, and basic rate limiting are configured on the NestJS app.
- [ ] File uploads (gallery, etc.) validate type and size, not just extension.

## How to use this

Run through the relevant section before closing out a phase task that touches these
areas, and mention explicitly in the phase summary (`docs/changelog.md`) which items
were checked and which are deferred to a later phase — don't silently skip items.
