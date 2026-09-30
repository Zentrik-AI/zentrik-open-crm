# Open CRM design system · "Clear" v2

The workspace helps a small team recognize an account, see what is true about it
and where that came from, and choose the next action. The interface should feel
calm, fast and precise: content leads, chrome recedes, and colour appears only
when it means something.

## Principles

1. **One thing to notice per surface.** A page has one title, at most one line of
   supporting text, and one primary action. Everything else is secondary.
2. **Show, don't explain.** Replace explanatory paragraphs with the thing itself:
   a state, a count, an example, an empty state with one sentence and one action.
   Help text belongs in a tooltip, a disclosure or the docs.
3. **Colour is meaning.** Neutral by default. Teal marks selection and the
   source-backed state. Violet marks agent work only. Green, amber and red describe
   real outcomes. Never use colour as decoration.
4. **No cards inside cards.** A card holds rows, not more cards. Use dividers,
   spacing and a quiet sunken well instead of nested borders.
5. **Motion confirms, it never waits.** Things arrive with a short rise and fade,
   and state changes animate in place. Nothing delays work to show an animation.

## Foundations

`src/tokens.css` owns every value. Tailwind reads them as `hsl(var(--token) / α)`.

| Role | Light | Dark | Use |
|---|---|---|---|
| `background` | near-white, cool | near-black, cool | page |
| `surface` / `card` | white | raised charcoal | cards, panels |
| `surface-sunken` | faint grey | deeper black | sidebar, wells, inputs at rest |
| `border` | 90% grey | 17% grey | every divider and card edge |
| `foreground` | ink | near-white | titles and primary text |
| `muted-foreground` | 38% grey | 66% grey | secondary text |
| `faint-foreground` | 46% grey | 58% grey | metadata, labels, timestamps |
| `primary` | ink | near-white | the one primary button per surface |
| `accent` | teal | teal | selection, source-backed, links |
| `agent` | violet | violet | agent proposals and agent state only |
| `success` / `warning` / `destructive` | green / amber / red | same | outcomes |

Every semantic ramp ships `DEFAULT` (marks, dots, icons), `-bg` (tinted chips)
and `-fg` (text on the tint, AA contrast).

### Type

Inter everywhere, with its display optical size for headings (bundled locally,
no network). Numbers use tabular figures (`tnum`). `font-mono` is for code,
commands and paths only.

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-display` | 30px | 600, -0.03em | one greeting or page hero |
| `text-h1` | 24px | 600, -0.025em | page and account titles |
| `text-h2` | 17px | 600 | section titles |
| `text-h3` | 15px | 600 | card and row titles |
| `text-body` | 14px | 400 | reading text |
| `text-body-sm` | 13px | 400/500 | controls, rows, secondary text |
| `text-label` | 12px | 500 | metadata, group labels, badges |

- 12px is the floor. Never `text-[10px]` or `text-[11px]` for readable text.
- Sentence case everywhere. No uppercase eyebrows or letter-spaced labels.
- Headings do not end with a full stop, except the greeting.

### Shape, depth and space

- Radius: controls `rounded-lg` (8px), cards `rounded-xl` (12px), pills `rounded-full`.
- Depth: cards carry `shadow-e1` (hairline), popovers `shadow-e2`, dialogs `shadow-e3`.
- Page gutter 32px desktop, 16px mobile. Card padding 20px. Row height 44px.
- Sections are separated by 28px. Inside a card, rows are separated by dividers.

## Components

- **Button:** `primary` (ink) once per surface; `secondary` (white, hairline,
  shadow) for everything else; `ghost` in toolbars; `accent`/`agent` only when the
  action is about a source or an agent.
- **Badge:** 22px tall, `rounded-md`, tinted `-bg` with `-fg` text. One badge per
  row unless the second carries a different meaning.
- **Card:** `Card` with an optional `CardHeader` (title + one line) and rows. No
  explanatory paragraph under a card title unless the card is empty.
- **Navigation:** grouped sidebar (Home · Accounts · Capture), neutral active
  state, counts in faint tabular numbers, the review count as a violet pill
  because something waits for a person.
- **Empty states:** icon, one sentence, one action.
- **Source links:** the teal underline marks a source-backed fact; a dashed
  underline marks a hunch. Keep it on facts, not on every link.

## Copy

- Titles name the thing: "Accounts", "Bring your accounts up to date".
- Supporting text is one line, 12 words or fewer, and only when it changes what
  the reader does next.
- Labels are nouns, buttons are verbs ("Investigate notes", "Apply this change").
- Say what happened, not what the system is ("3 changes saved", not "The system
  has successfully saved your changes").

## Motion

Tokens: `--d-fast` 140ms, `--d-base` 220ms, `--d-slow` 360ms; `--ease-out` for
arrivals, `--ease-in-out` for moves. Arrivals rise 4–6px and fade. Lists stagger
by 40ms, capped at 8 items. Everything honours `prefers-reduced-motion`.

## Contracts that must not change

End-to-end tests and the ProductTank demo script depend on accessible names and
visible labels (`tests/e2e/*.spec.ts`, `docs/account-investigation.md`). Keep
those strings, or update the tests and the script in the same change.
