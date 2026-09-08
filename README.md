# Nirikshan Compliance Scan

# NIRIKSHAN AI — Build Prompt for Google AI Studio

Paste everything below the line into AI Studio's Build prompt box.

---

Build a polished, production-quality responsive web application called **Nirikshan AI** — a Legal Metrology compliance-scanning tool for the Indian Department of Consumer Affairs. It lets Enforcement Officers and Citizens scan a packaged product's label with a phone/laptop camera, automatically checks it against the mandatory declarations required under the Legal Metrology (Packaged Commodities) Rules, 2011, and produces a shareable compliance report.

## 1. App identity & landing

- App name shown prominently on first load: **Nirikshan AI**, with a short tagline like "Scan. Verify. Comply." Clean, trustworthy, govtech-modern visual identity (not a dull government-portal look) — think a fusion of a civic-trust palette (deep blue/green, white) with a modern SaaS feel: soft shadows, rounded cards, generous whitespace, subtle motion.

- From the landing screen, the user picks **"I'm an Officer"** or **"I'm a Citizen"** before logging in.

## 2. Authentication

- Single sign-on via **"Sign in with Google"** for both roles — no separate password/OTP form. Flow: user taps the button → Google account picker → user grants permission → redirected back to Nirikshan → authenticated.

- **Citizen accounts**: on first Google sign-in, auto-create a citizen profile and grant dashboard access immediately.

- **Officer accounts**: on first Google sign-in, do NOT grant officer-dashboard access automatically. Show an additional "Enter your Officer ID" step, validated against a seeded list of sample officer IDs, before unlocking the officer dashboard. Once verified, link that Officer ID to the Google account so future logins for that account skip straight to the dashboard.

- After the flow completes, route to the correct dashboard based on role.

## 3. Officer Dashboard

- Top summary cards: total scans, pass rate, pending reviews, flagged-by-citizens count.

- Big primary action: **"Scan a Product"**.

- Two tabs/sections:

  - **Activity** — full chronological history of the officer's scans, each row showing thumbnail, product name, status badge (Pass / Fail / Needs Review), date-time, location.

  - **Reports** — searchable/filterable list of generated reports, each opens the full report detail view.

- A **visualization panel**: charts for scans-over-time, pass vs fail ratio, most common missing declarations (this doubles for the Citizen dashboard too).

## 4. Scan flow (shared by both roles)

1. User taps "Scan a Product" → chooses **Take Photo** (camera capture, multiple angles allowed — front label, back label, MRP sticker) or **Upload Image**, plus an optional **Scan Barcode** step.

2. If the barcode matches a product already in the local product repository, prefill known static fields (name, category) to save re-scanning, but always still analyze the freshly captured label images.

3. Show an animated analysis/loading state ("Reading label…", "Checking declarations…", "Matching against Legal Metrology Rules…").

4. Capture device geolocation (lat/long) and timestamp at the moment of scan.

## 5. Compliance rule engine (core logic — implement this carefully)

Use a Gemini multimodal model to read the label images and return **structured JSON**, not free-text — e.g. `{ field, valuePresent, extractedValue, legible, fontSizeAdequate, confidence }` for each declaration. Do not use a generic OCR text dump; prompt Gemini to extract each field explicitly.

Mandatory declarations to check (from the Legal Metrology (Packaged Commodities) Rules, 2011):

1. Manufacturer / Packer / Importer name & address

2. Country of origin (imported goods only)

3. Product / common name

4. Net quantity

5. Manufacturing month & year

6. Best Before / Use By (only where applicable — e.g. food, cosmetics; not applicable to, say, hardware)

7. MRP inclusive of all taxes

8. Consumer care details (address/phone/email for complaints)

9. Dimensions (only where applicable — e.g. tissue/paper products)

10. Unit sale price (for multi-packs)

Cross-cutting requirement applied to every field above: **legibility and prominence** — flag a field as non-compliant if it's present but in illegibly small text, low contrast, or hidden in a cluttered area, not just if it's missing outright. Estimate this from relative text height / contrast in the image, and mark it as a separate "legibility" flag distinct from "presence."

- Make applicability **category-driven**: let the officer/citizen pick or confirm a product category (Food, Cosmetics, Electronics, Textiles, Stationery, Other) at the start of the scan, and only apply the fields relevant to that category (e.g. skip Best Before for electronics).

- Compute an overall status with **three states**, not just pass/fail:

  - **Compliant** — all applicable fields present and legible.

  - **Non-Compliant** — one or more mandatory fields missing or illegible.

  - **Needs Manual Review** — low OCR confidence on one or more fields (let a human officer confirm rather than auto-failing).

## 6. Report generation

- After analysis, generate a report screen showing: overall status badge, a checklist of every applicable declaration with ✅/❌/⚠️ and the extracted value shown for each, the captured photos, geolocation (lat/long shown on a small map or as coordinates), and date/time of scan.

- **Export as PDF** and **Editable format** (e.g. also export the underlying JSON/CSV).

- **Share button**: share the report via WhatsApp and generic device share sheet (Web Share API), plus a copyable link.

- Every report is saved to that user's Activity history and to the aggregate Reports repository.

## 7. Citizen-only additions

- **Flag to nearby officer**: if a scan comes back Non-Compliant or Needs Review, show a "Send to nearby officer" button. Mock a simple jurisdiction/distance match against a seeded list of officer accounts with home coordinates, and create a "citizen-flagged case" that appears in the matched officer's dashboard in a distinct "Citizen Reports" queue, pending officer acknowledgement.

- **Health/nutrition grading (bonus differentiator, food products only)**: after the compliance report, offer a second, separate "Product Health Snapshot" — extract nutrition-table values (calories, fat, protein, sugar, sodium per serving) via the same Gemini vision step, and classify into a simple traffic-light-style grade (e.g. A–E or Good/Moderate/Poor per Nutri-Score-style logic). Clearly label this as informational/wellness content, separate from the legal compliance verdict, and only show it when the product category is Food/Beverage.

## 8. Data model (mock/local persistence is fine for the prototype)

- `Users` (role: officer/citizen, id, name, contact, home coordinates for officers)

- `Products` (barcode, name, category, cached static fields)

- `Scans` (user id, product ref, images, geolocation, timestamp)

- `Reports` (scan ref, per-field results, overall status, PDF/export link)

- `CitizenFlags` (report ref, assigned officer, acknowledgement status)

## 9. Visual/UX direction

- Mobile-first responsive layout (most scanning happens on a phone browser camera).

- Color-code status everywhere: green (Compliant), red (Non-Compliant), amber (Needs Review).

- Smooth, purposeful micro-animations: card entrance transitions, an animated scanning overlay during analysis, a satisfying checklist reveal animation on the report screen. Avoid gratuitous motion that slows down real usage.

- Use a small set of custom icons/illustrations for empty states (no scans yet, no flags) — generate these as clean, flat, on-brand illustrations rather than photorealistic images.

- Keep officer and citizen views visually related but distinguishable (e.g. a subtle badge/color accent difference) so it's always clear which mode is active.

## 10. Non-functional requirements

- Role-based access control: citizens must never see other users' raw personal data, only aggregate stats.

- Full audit trail: every scan and status change is timestamped and attributed to a user.

- Handle camera/geolocation permission errors gracefully with clear fallback messaging.

- All screens should be navigable with realistic seeded sample data so the whole flow can be demoed end-to-end without a live backend.

## 11. Deliverable

A fully working single-page app covering: landing → role selection → auth → dashboard → scan → analysis → report → history/activity → sharing, plus the citizen-only nearby-officer flagging and nutrition snapshot. Wire up real Gemini API calls for the label-reading step with a clear, well-documented JSON schema for the response.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dfefa8c4-eff1-4c83-9ad6-7df2a6e05477).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
