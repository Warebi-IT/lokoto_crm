# Design — Rules for AI Agents

- /packages/ui is the single source of truth for all UI.
- Always use shared shadcn components from /packages/ui.
- Do not override component styles with className.
- Do not introduce custom border radii, spacing, colours, shadows, or other visual deviations.
- Corners are rounded, from the scale only: `rounded-sm` (4px) for the smallest
  controls, `rounded-md` (5px) for buttons, inputs and segments, `rounded-lg`
  (8px) for transient overlay chrome — popovers, dropdown menus, select
  content, the command palette — and `rounded-xl` (12px) for persistent
  content surfaces — cards, card panels, dialogs, alert dialogs, table shells.
  The larger radius is what reads as a place things live; the smaller one is
  what reads as a thing that appears and disappears. Never a literal radius at
  the call site.
- `rounded-none` is still correct in one case: an element that must join its
  neighbour edge to edge. The input inside an input group, the middle cells of
  a selected date range, and the drawer handle are the existing examples.
- Persistent content surfaces (`Card`, `CardPanel`, table shells) carry a
  resting `shadow-xs` in addition to their border. A border alone reads as a
  seam in the page; the shadow is what makes the surface read as sitting above
  it, which is the difference between "square" and "designed."
- If a component needs a new variant or style, implement it in /packages/ui so the entire application stays consistent.

## Colour

Flat white, neutral greys, and one brand green (`#006B4F`), plus one dark
forest green (`#0B2E22`) reserved for the app's persistent chrome — the icon
rail. The greys are untinted on purpose: there is no scene to tint them
toward, and a tinted grey without a reason reads as indecision.

**Only two things are filled**: `primary` for the action you want, `destructive`
for the one you cannot undo. Everything else — secondary, outline, ghost — is a
white chip in light and a dark chip in dark. That is what keeps a rep's eye
landing on *go* or *stop* and skimming past the rest.

`--primary` and `--destructive` hold the **same value in both themes**. A brand
colour that changes per theme is not one colour, it is two, and both then need
maintaining. The single exception is `--ring`, which lightens in dark: a fill
carries the brand, but a ring only has to be seen, and `#006B4F` is too close to
the dark background to register.

### The rail

The `--sidebar-*` tokens are reserved for the app icon rail (`AppIconRail`)
and hold the **same forest-green values in both themes** — the rail is the
app's spine, not a themed surface, so it does not flip with light/dark mode
the way `--background` does. It is the one place besides `primary` and
`destructive` allowed to be a dark fill; do not reuse `--sidebar-*` for
anything else, and do not give any other component a hand-rolled dark-green
background — that is a new colour, not a reuse of this one.