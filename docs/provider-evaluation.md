# Provider implementation and evaluation

The allowlist currently contains one pinned model:
`gpt-4.1-mini-2025-04-14`. It is documented with text/image input, the Responses
endpoint and structured outputs. There is no user-supplied model or base URL.

Official documentation consulted during implementation:

- https://developers.openai.com/api/docs/models/gpt-4.1-mini
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/images-vision

The official JavaScript SDK uses `responses.parse` and `zodTextFormat`. The backend
revalidates output, expiry evidence, image indices, quoted spans, allowed records,
and source references. Structured output is a format contract, not an accuracy or
medical-safety guarantee. No model output writes inventory or performs actions.

Synthetic tests evaluate the application's response handling, consent, privacy,
timeout, refusal, incomplete/schema failures, limits and commit invariants. They
do not evaluate this model's OCR accuracy or its clinical reasoning. No live
provider calls were authorized or made during implementation.

Before any real OCR-quality claim, separately evaluate consented, representative
package/receipt samples, including missing expiry, blurry text, glare, embossed
small dates, multiple conflicting images and Cyrillic text. Record sample
provenance, model snapshot, extraction errors, and human review outcomes. Never
skip review based on model confidence or treat OCR as clinical verification.
