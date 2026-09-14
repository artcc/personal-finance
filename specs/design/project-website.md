# Project Website

Status: implemented; authorized, scoped local format/lint checks passed for the original implementation. The subsequent automatic-only theme update has not been rechecked. Browser verification remains pending. No GitHub Pages publication or repository visibility change has been performed.

## Scope and content

The owner requested a simple English website for the open-source project. `docs/index.html` contains the hero, top navigation, monthly-planning illustration, feature summary, self-hosting section, and repository/license links. The illustration describes the planning flow; it contains no invented financial results or user data. The page states that the application interface is initially Spanish.

Content covers implemented monthly planning, accounts/spaces, commitments/provisions, financing, investment movements/manual valuations, and compatible JSON portability. JSON runtime verification remains pending in CI. Do not add testimonials, usage statistics, automatic bank/market feeds, or unimplemented capabilities.

## Files and presentation

- `docs/index.html`: semantic English content and relative local asset links.
- `docs/css/styles.css`: shared color tokens, responsive layouts, visible focus, and reduced-motion handling. Uses system fonts and the approved teal direction.
- `docs/js/theme.js`: synchronizes the browser's theme-color metadata with system appearance; no storage, framework, API requests, or analytics.
- `docs/assets/favicon.svg`: local project favicon.
- `docs/assets/github/`: official black/white GitHub Invertocat SVGs from [GitHub's brand archive](https://brand.github.com/GitHub_Logos.zip), linked from [GitHub Logos](https://github.com/logos). Source filenames are `GitHub Logos/SVG/GitHub_Invertocat_Black.svg` and `GitHub Logos/SVG/GitHub_Invertocat_White.svg`. GitHub marks remain subject to GitHub's brand guidelines.
- `docs/.nojekyll`: allows plain static delivery when GitHub Pages is configured.

Header and page sections share the same container. Layouts collapse for smaller viewports. Navigation and repository links use native anchors. A skip link precedes the header.

## Theme behavior

- The website always follows `prefers-color-scheme`, including changes while the page is open.
- There is no manual theme selector. CSS selects the palette directly from the system preference.
- No theme preference is read or stored; previous stored selections have no effect.
- The black GitHub mark appears on light surfaces; the white mark appears on dark surfaces.
- Without JavaScript, the page and GitHub marks still follow the system theme through CSS.

## Review and delivery

Local evidence (2026-09-14): with owner authorization, Prettier was applied to `docs/index.html`, `docs/css/styles.css`, `docs/js/theme.js`, and `eslint.config.mjs`; a subsequent check passed for those files. ESLint passed for `docs/js/theme.js` and `eslint.config.mjs`. Commands used the existing Node installation through `node scripts/pnpm-local.mjs exec`. No build, test, or browser validation was run.

Open `docs/index.html` directly without a build or server. With separately approved browser review, check narrow/wide layouts, keyboard access, system appearance changes, and logo contrast. Format/lint checks establish source consistency, not visual or accessibility acceptance.

The site uses relative paths suitable for a GitHub Pages project subdirectory. Actual publication, repository visibility changes, external-link verification, and release acceptance need their own authorization and evidence.
