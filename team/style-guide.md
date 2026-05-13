# CalvyBots Dashboard Style Guide (v3)

## Design philosophy

- Charcoal-first dashboard with restrained accent and deliberate depth.
- Keep the interface fast to scan, fast to control, and easy to read in all zones.
- Use layered surfaces and muted shadows to create hierarchy, not harsh contrast.
- Keep motion calm and short; avoid dramatic transitions.

## Colour tokens

- `bg` (`#1c1c1c`) — page background
- `surface` (`#242424`) — major surfaces such as cards and header blocks
- `elevated` (`#2e2e2e`) — raised controls, pills, utility surfaces
- `border` (`#3d3d3d`) — separators and edge treatment
- `accent` (`#2dd4bf`) — cyan action/highlight color
- `text-1` (`#f0f0f0`) — primary text
- `text-2` (`#9a9a9a`) — secondary text
- `text-3` (`#5c5c5c`) — muted metadata

## Typography scale

- Headline (`h1`)
  - `1.5rem` to `1.875rem`
  - `font-weight: 600`
  - `line-height: 1.2`
- Section title (`.widget-title`)
  - `0.72rem`
  - `font-weight: 600`
  - `line-height: 1.1`
  - all caps with extra tracking
- Body (`p`, `div`, `li`, widget copy)
  - `1rem`
  - `font-weight: 400`
  - `line-height: 1.45`
- Caption/helper (`small`)
  - `0.75rem`
  - `line-height: 1.3`
  - use muted text tone

## Spacing

- Base unit: `4px`
- Keep dense spacing inside cards and generous section gaps outside.

## Depth model

- `body` uses low-contrast ambient gradients to avoid flatness.
- Cards use layered gradients, edge tint and soft lift.
- Hover actions use border-lightening + small lift.
- Use `rgba` accents for subtle depth accents, avoid heavy bloom.

## Component patterns

- Card (`.dash-widget`): gradient fill, soft border, lift on hover.
- Primary button: gradient accent with strong contrast text.
- Soft button: dark neutral gradient + border.
- Inputs: dark background, high contrast focus outline.
- Widget shell: title and controls stay inside each widget.

## Interaction

- Hover: keep to short duration, subtle movement.
- Focus: visible `:focus-visible` and consistent contrast.
- Touch: minimum `42px` controls for mobile.

## Motion

- Default transition cap: `240ms`
- `ease-out` only
- Keep load states lightweight and deliberate.

## Accessibility requirements

- No duplicated widget titles.
- Icon-only controls require clear accessible names.
- All controls must have clear names and labels.

## Mobile web app bookmarking

- `manifest.webmanifest` present with:
  - `display: standalone`
  - `start_url`
  - `scope`
  - `theme_color`
  - `background_color`
  - `icons`
- `apple-mobile-web-app-capable` metadata should be available.
- Add safe-area padding when the app runs in standalone mode.
