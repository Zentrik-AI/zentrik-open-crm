# Product and launch design

The workspace helps a small team recognize a relationship, inspect its evidence,
and choose the next action. Content leads; color identifies state or kind.

## Shared foundations

`src/tokens.css` owns the light/dark palette, font families, type scale, spacing,
radii and motion. `src/fonts.css` bundles licensed fonts locally: Fraunces for
page/section headings, Inter for controls and prose, IBM Plex Mono for numbers
and identifiers. The app and launch composition import these same sources.
Font loading does not require Google or another external service.
The class merger in `src/lib/utils.ts` registers the custom font-size names;
otherwise it mistakes them for colors and drops size or foreground utilities.

Use `text-display` for a page greeting, `text-h1` for a route/account heading,
`text-h2` for a section and `text-body` for work. Labels use a readable 12px
floor. Keep paragraphs sentence case. Body metrics do not inherit display
tracking. Align primary content to the shared 24px gutter and 20px panel inset.

Surfaces use quiet dividers. Form controls retain a stronger boundary so users
can distinguish inputs from information. Teal identifies selection and primary
actions; violet identifies agent work; green/red describe actual outcomes.
Unknown values remain unknown. Counts render their real value immediately.

## Review decisions

User/job: founders and operators moving between accounts, sources, actions and
agent proposals. Failure: cramped account names, repeated summary meters, weak
type hierarchy, external font dependency, and launch fragments using a second
visual language. Must notice first: the account name, next action and source.

Design-language comparison used the same Home fixture at 1440×1000:

- Editorial: retain warm paper and serif headings; quiet borders; use compact
  sans-serif controls. Selected for legibility and continuity with the product.
- Utilitarian: all sans-serif, square cards, narrower navigation. Rejected as
  the primary character because section titles lost hierarchy; retain its
  immediate numeric values and compact navigation.
- Nocturne: dark green substrate and light ink. Rejected as the default because
  source/state colors competed; preserve the existing semantic dark theme.

Account-list structure comparison:

- Metric cards (existing): health ring, fit bar, value and priority competed with
  the name. Reject repeated metrics; retain detail-view metrics.
- Dense table: good cross-account comparison, poor fit beside a selected account
  at laptop widths. Keep the existing Pipeline surface for comparisons.
- Relationship list: full wrapping names, segment, stage/owner and value. Selected
  for recognition and enough room for the detail panel.

Subtracted: redundant demo badge, permanent storage marketing card, low-context
metric bars, list-level health/fit repetitions, and an extra “vitality” label.
Storage detail stays accessible through disclosure. “Next actions” replaces
“Today” because the list includes future work. Feedback history is labeled local,
not a live shared roadmap.

## Verification contract

Exercise onboarding, Home, Accounts, Tasks, Review and Improve at desktop and
390px width, light/dark, reduced motion, and offline font delivery. Check actual
proposal approval, stale proposal rejection, feedback export scope, full account
name visibility, no horizontal document overflow and keyboard focus. Compare
equivalent synthetic records; keep task-specific screenshots in ignored `tmp/`.

Launch assets are illustrative and say so. Share the real fonts/tokens and show
source → proposal → individual approval → record change. Do not imply bulk
approval, automatic customer messaging, connected cloud feedback, or a released
feature when only a local draft exists. The exported film uses its own fixed
frame clock; playback controls honor reduced motion and never autoplay audio.
