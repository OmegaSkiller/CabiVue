# Localization

English, Bulgarian, Simplified Chinese, Hindi, Spanish, French, Arabic, Bengali,
Portuguese, and Russian are bundled. The eight additions beside Bulgarian were
chosen for broad total-speaker reach; rankings depend on how speakers are counted.
The native-name language selector is available before and after login. A saved
browser preference wins over browser language detection; unsupported languages
fall back to English. Arabic sets document direction to RTL. Switching languages
preserves mounted forms and their drafts.

## Translation contributions

`src/web/i18n.ts` owns locale selection, direction, number/date presentation and
counted units. `src/web/locales/en.json` is the source catalog. Add complete
sentences rather than assembling translated fragments. Keep `{{placeholders}}`
unchanged and include every plural category returned by `Intl.PluralRules` for
the locale. Call translations while rendering, so a language change updates
existing views. Keep canonical option values separate from visible labels.

Catalogs were initially machine translated from public interface text, with
manual Bulgarian terminology and counted-unit/plural corrections. They have
**not** received comprehensive native-speaker or clinical review. Contributions
should review contextual accuracy, warnings, urgent-help text, privacy/consent,
and narrow-screen layouts. Clinical wording needs the review described in
[Contributing](../CONTRIBUTING.md) before public medical use.

User-entered names, notes, interview quotes, extracted evidence and reviewed
source facts stay verbatim. Protocol enums, `RESTORE`, ISO date input values,
quantities and database records stay language independent. Month-only expiry
presentation does not invent a day. Stored household timezone is independent
of display language. Existing selected English/Bulgarian/Russian urgency phrase
matching is not comprehensive multilingual clinical screening; explicit risk
answers and fixed urgent help remain authoritative.

No translation service runs in the app. All catalogs are included in the public
PWA shell and remain available offline. Only the selected language code is
stored as a browser preference. Latin/Cyrillic use the supplied brand fonts;
other scripts use installed system font fallbacks without remote font requests.

## Verification

Run `npm run check`, `npm run test:e2e`, `npm run test:pwa`, and
`npm run format:check`. Catalog tests enforce source coverage, placeholder parity,
plural categories, fixed question coverage and exact restore tokens. Browser
checks cover Bulgarian expiry warnings, Arabic direction/accessibility, draft
retention, canonical units, persistence and all ten locales at 320/390/1440 px.
