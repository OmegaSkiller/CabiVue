# Privacy and clinical scope

Inventory works without an AI key. It stores household-owned product identities,
physical packs, dates, locations, notes and optional purchase metadata in SQLite.
Cabinet ownership does not mean the person has taken that medicine.

The application supports inventory organization, reviewed general leaflet facts
where actually supplied, and an adult symptom-history draft for a consultation.
It does not diagnose, exclude disease, select a personalized medicine, generate a
dose/regimen, check broad interactions, or change prescriptions. The red-flag
patterns and interview design have not undergone clinical validation. Clinical
and regulatory review are required before using this as a public medical service.

No real medicine catalog or copied leaflet text is bundled. Product identity
checked by a user, OCR output, and source review are separate concepts. Source
facts require exact formulation, official URL, revision, provenance and review.
Unknown expiry, uncertain storage, missing required opening information, expired
stock, or absent sources block product-specific guidance. Inventory badges never
establish suitability. No licensed source coverage means no leaflet guidance.

## What leaves the instance

With deliberate per-request consent, OpenAI receives only:

- Scan: the selected one to three photos, after bounded decoding, orientation
  normalization and re-encoding that removes metadata. Visible receipt payment
  information remains visible content; crop it out before uploading.
- Interview extraction: the current answer, current interview group, application
  urgency state, and allowed facts/limitations of the single selected pack. Other
  cabinet records and previous answers are not automatically sent.

OpenAI processing is remote and may cost money. BYOK does not make it local.
Requests use the fixed official endpoint, a pinned model, a 45-second deadline,
no automatic retries, at most two simultaneous requests across the instance and
one per session, and six attempts per session per minute. Provider refusals,
incomplete results, invalid schemas and unsupported references are not displayed
as medical advice. Tests and demo mode simulate results and make no paid calls.

Provider keys are held in server memory for the authenticated session. They are
cleared on explicit removal, logout, expiry and restart. They do not enter SQLite,
exports, browser storage, prompts, URLs or logs. The provider necessarily receives
the key as authentication. Never configure an untrusted reverse proxy to log
request bodies or authorization headers.

## Retention and caches

Photos stay in bounded request buffers and browser previews. They are not written
to disk, stored in SQLite, backed up or cached. Preview object URLs are revoked on
removal, completion or cancellation. Draft text lasts up to 30 minutes and is
cleared after confirmation, cancellation, expiry or restart. SQLite deletion is
logical deletion, not a claim of forensic secure erasure from WAL/storage media.
An import consumption record remains for idempotency and duplicate review.

Interview history is transient session memory and is cleared on logout, expiry,
explicit clearing and restart. It is not automatically saved. Confirming a summary
confirms its reported contents for the session; it is not clinical verification.

The PWA caches only the public app shell, fonts and logos. No API response, private
inventory, key, draft, chat or image is cached. Offline writes are unavailable.
The open page may still display previously fetched memory while disconnected;
reconnect before saving or relying on current stock. Private data is cleared from
the app on sign out. Only the non-sensitive theme preference uses localStorage.

Exports and recovery points contain plaintext inventory/health-related notes.
Protect them as private records. They exclude account credentials, sessions,
provider keys, transient interviews and extraction media/drafts. The application
has no third-party analytics, external fonts, or tracking scripts.
