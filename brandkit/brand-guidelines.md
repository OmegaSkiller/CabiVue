# Cabivue

**Know what you have.**

A calm identity for an open source household medicine organizer: see what is in your cabinet, keep track of expiry dates, and prepare better questions for a pharmacist or doctor.

## Name and positioning

**Cabivue** combines *cabinet* and *view*. Say **KAB-ee-view**. Write **Cabivue** in prose and **cabivue** in the logo. Use the full name rather than an abbreviation.

The promise is visibility and order. The app should feel helpful in an ordinary home, especially when someone feels unwell and has little patience for a complicated interface. Its assistant supports information gathering and verified leaflet education; the brand must not imply that it diagnoses, prescribes, or certifies a medicine as suitable for someone.

Suggested short description: **“Your home medicine cabinet, clearly organized.”**

Suggested project introduction: **“Cabivue is an open source medicine-cabinet app. Track your packs and expiry dates, review scanned labels, and collect information to discuss with a healthcare professional.”**

Cabivue is a proposed working name. Preliminary exact-name web searches returned no obvious matches, but domain availability and trademark clearance have not been established. Check relevant registries, markets, app stores, and domains before a public launch.

## Color

| Color | Hex | Role |
| --- | --- | --- |
| Harbor | `#125B57` | Logo, primary actions, selected navigation |
| Linen | `#F7F6F2` | Main light background, reversed logo |
| Graphite | `#162B2A` | Body text and headings |
| Mist | `#DCE9E5` | Supporting surfaces and quiet grouping |
| Apricot | `#E7B17B` | Small highlights and editorial accents |

Let Linen dominate light screens, with Graphite text and Harbor actions. Use Mist to separate related information. Keep Apricot sparse; it is a brand accent rather than a universal warning color. Avoid gradients on functional surfaces.

Supporting light tokens: secondary `#3D625E`, muted text `#526C67`, essential control border `#6A837B`, information `#245C7C`, success `#27664F`, warning `#8A531E`, error `#B13F3B`. Filled semantic components use Linen text. The darker warning color provides readable warnings; Apricot remains available for noncritical highlights.

Dark mode uses a deep green background `#132321`, surfaces `#1B302D` / `#244039`, text `#EFF4F1`, muted text `#ADC4BC`, and mint primary `#9DD5C5`. Its semantic colors and matching foregrounds are defined in `cabivue-theme.css`.

Color never carries status alone. Pair it with plain text and, where useful, an icon:

| State | Treatment | Meaning |
| --- | --- | --- |
| In stock | Neutral text / quiet surface | Quantity exists; no clinical claim |
| Expiring soon | Warning + date / clock | A pack needs attention |
| Expired | Error + date / warning | The recorded expiry has passed |
| Expiry unknown | Warning + “Add an expiry date” | Required information is missing |
| Scan needs review | Information + scan symbol | Extracted values await confirmation |
| Saved | Success + confirmation | An inventory action completed |

Do not label an unexpired pack “safe to take.” A green badge does not establish suitability, correct storage, lack of interactions, or safe use.

## Typography

**Onest** is the primary font for headings, interface labels, buttons, and body text. Use 400 for body copy, 500 for labels, 600 for buttons and subheadings, and 700 for major headings. The logo uses outlined Onest 600 glyphs.

**IBM Plex Mono** is the supporting font for dates, batch identifiers, quantities, and short technical values. Use 400 or 500. Keep explanatory text in Onest.

Suggested mobile scale: 30–32px page title, 22–24px section title, 18px card title, 16px body and fields, 14px secondary labels. Use a body line height near 1.5. On desktop, large introductory headings can reach 40–48px. Never shrink essential medicine names or instructions to fit a card; wrap them.

Use sentence case. Avoid long all-cap labels. Show human-readable dates with the original precision; an unknown day must not appear as a guessed date. Use tabular numerals where values align in a list.

The bundled fonts support Latin and Cyrillic and carry SIL Open Font Licenses. Their license texts, source URLs, and file hashes are included in `fonts/`. Self-host them; the identity does not require a third-party font request.

## Visual style

Warm, domestic, precise. Use softly rounded rectangular forms, generous space, and a clear hierarchy. The palette should suggest a well-organized cupboard in daylight.

- Work on a 4px spacing rhythm; common gaps are 8, 12, 16, 24, and 32px.
- Use 16px mobile page padding, 16px card corners, 12px field corners, and restrained shadows for overlays or elevation.
- Keep mobile inventory as readable cards. Put Add / Scan within easy reach. Open chat as a full-width mobile screen; reserve the assistant sidebar for wide layouts.
- Use simple line icons at consistent sizes and stroke weights. Every important action needs a visible label.
- Buttons and fields should comfortably support touch, usually at least 44px tall. Show a strong focus indicator and preserve keyboard behavior.
- Motion should be brief and functional. Respect reduced-motion preferences.
- Photography: matte packaging, amber glass, paper labels, pale shelves, and soft daylight. Use neutral or fictional packaging in promotional material.

Avoid glossy healthcare stock imagery, white-coated authority figures, neon, AI sparkles, medical crosses, shields, capsule mascots, and decorative gradients. Keep textures in campaign imagery, away from reading and editing surfaces.

## Tone and copy

Speak plainly, calmly, and without judgment. Describe what is known, what is missing, and the next useful action. Keep important instructions specific; avoid both alarmist language and false reassurance.

| Situation | Preferred wording |
| --- | --- |
| Empty cabinet | “Your cabinet is empty. Add a medicine or scan a label.” |
| Primary action | “Add medicine” |
| OCR result | “Review scan” |
| Uncertain recognition | “We couldn’t read the strength. Check the label and enter it.” |
| Missing date | “Expiry unknown” / “Add an expiry date” |
| Due date | “Expires in October 2027” when only month/year are known |
| Saved pack | “Added to your cabinet.” |
| External AI processing | “This photo will be sent to [provider]. Review what will be shared before continuing.” |
| Assistant scope | “I can help collect your symptoms and explain verified leaflet information.” |
| Professional help | “Ask a pharmacist or doctor whether this medicine is suitable for you.” |
| Urgent symptoms | “Get urgent medical help now.” followed by the applicable action |

Avoid promises such as “AI pharmacist,” “the best medicine for you,” “nothing serious,” or “doctor-approved” without a real basis. In urgent situations, clarity takes priority over a relaxed brand voice. The system's clinical boundaries and escalation rules remain authoritative.

## Logo

The mark combines an **open C-shaped cabinet frame** with **one floating shelf**. The initial connects it to Cabivue; the shelf connects it to the product. Rounded geometry gives it a familiar, approachable character.

Canonical assets:

- `logos/cabivue-logo.svg`: horizontal mark and outlined wordmark, Harbor.
- `logos/cabivue-logo-reversed.svg`: the same lockup in Linen for dark surfaces.
- `logos/cabivue-wordmark.svg`: standalone lowercase wordmark.
- `logos/cabivue-mark.svg` and `cabivue-mark-reversed.svg`: standalone symbol.
- `logos/cabivue-app-icon.svg`: square Linen background with a centered Harbor mark.
- `logos/png/`: transparent logo exports and 192px / 512px PWA icons, 180px Apple touch icon, and 32px favicon.

Keep at least one logo-stroke width of clear space around the visible mark or lockup. Start with a 140px minimum width for the horizontal lockup and a 24px standalone mark in ordinary UI. The favicon is the deliberate small-size exception. Evaluate legibility in the actual context before shrinking further.

Preserve aspect ratio, letter spacing, geometry, and symbol-to-wordmark proportions. Do not stretch, rotate, add effects, put the logo inside a medical cross, or redraw the symbol with a different shelf count. Use the mark alone in compact navigation only after the app's name is clear elsewhere.

Prefer the SVG assets for interface and print work. Their wordmark is outlined, so it renders independently of font loading. Use a meaningful `alt="Cabivue"` for a logo image; use empty alt text if adjacent accessible text already supplies the name. Use the supplied full-background icon for platform masking rather than baking a rounded-square silhouette into the image.

## Board and implementation

`cabivue-brand-overview.png` is an art-directed concept board generated with the brandkit skill and built-in image generation. Its mockups illustrate the identity; they do not depict an implemented app. Generated letterforms and mockup details may vary slightly. The SVG files, exact color values, bundled fonts, and CSS are the canonical implementation assets.

`cabivue-theme.css` defines light and dark daisyUI themes, local font loading, essential field borders, and focus treatment. See `README.md` for integration. The board-generation prompt is included for reproducibility.

Numerical contrast checks are recorded in `verification.json`. These checks cover the specified palette pairs; they do not constitute a complete accessibility audit or a compiled application test.
