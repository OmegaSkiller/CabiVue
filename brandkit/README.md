# Cabivue brandkit

**Know what you have.**

Start with [the overview board](cabivue-brand-overview.png) and [the brand guidelines](brand-guidelines.md). The board is a visual concept; SVGs, font files, color tokens, and guidelines define the implementation.

## Included

- A 3 × 3 identity overview and the image-generation prompt.
- Six scalable SVG assets: logo, reversed logo, wordmark, primary/reversed mark, app icon.
- Seven PNG exports, including PWA icons, Apple touch icon, and favicon.
- Onest variable and IBM Plex Mono regular/medium fonts, with their SIL OFL licenses and source metadata.
- Light and dark daisyUI themes, font loading, and palette verification results.

## Use in the app

1. In a project already configured for Tailwind CSS 4 and daisyUI 5, copy `cabivue-theme.css` and `fonts/` together into a source assets directory. Keep their relative paths intact.
2. Import this stylesheet from the app entry. It includes Tailwind and daisyUI setup, so consolidate existing imports/plugin declarations rather than installing the same stylesheet twice. Follow current library documentation when adapting the build configuration.
3. Use `data-theme="cabivue"` or `data-theme="cabivue-dark"` on the document root. The CSS also marks the light theme as the default and the dark theme as the preferred dark variant. Select the explicit theme from the app's theme control.
4. Use semantic classes such as `bg-base-100`, `text-base-content`, `btn-primary`, and `badge-warning`. Use `font-mono` for short dates and batch values. The optional custom variables are `--cabivue-muted` and `--cabivue-border`.
5. Use SVG logo images with accessible names. Put PNG icons in the app's public assets directory and reference their actual paths from the web manifest and HTML. Supply both 192px and 512px PWA icons. The supplied square background and centered artwork support platform masking; verify the manifest and installed result on target devices.
6. Verify the implemented interface at mobile and desktop sizes, in both themes, with keyboard access, focus visibility, text zoom, long names, and Cyrillic text. Preserve text/icon explanations for expiry and urgency states.

This is a brand asset package, not a running application. Theme syntax was checked against current daisyUI documentation; the stylesheet has not been compiled in an application build. `verification.json` records asset integrity and numerical palette checks, not complete UI accessibility certification.

The existing application build prompt in the parent `outputs/` directory has been updated to reference this identity.

## Sources and licensing

Font source links, SHA256 hashes, and retrieval dates are in `fonts/sources.json`. Preserve both included OFL license texts when distributing the fonts. These are the only third-party assets bundled in this kit.

The brand board was generated with the invoked brandkit skill and built-in image generation. The canonical mark was drawn as vector geometry and the wordmark exported from the bundled Onest font. Apply the project's chosen license to original brand assets when publishing; the font licenses remain separate.

Cabivue is a working name; domain and trademark clearance remain unverified.
