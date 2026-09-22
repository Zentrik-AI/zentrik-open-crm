# Launch assets

Audience: founders and small teams who work with coding agents. Job: show how
source context becomes a reviewable next action in a workspace they control.

Open `launch/index.html` through the existing Vite dev server. The preview has
play/pause, a scrubber, and an Open CRM/Ozarm title comparison. It starts paused
and does not autoplay audio. Product name remains Open CRM; Ozarm is a naming
study, not a cleared trademark or a market-first claim.

The app and composition share `src/tokens.css` and bundled `src/fonts.css`.
The launch surface has no production dependency or second build system. It uses
the repository's React, Lucide, Vite and Playwright. FFmpeg is needed only to
export media. Output goes to ignored `tmp/launch/`.

```sh
# Run the existing dev server first, using your worktree's allocated port.
LAUNCH_URL=http://127.0.0.1:5203/launch/index.html node launch/render.mjs --stills
LAUNCH_URL=http://127.0.0.1:5203/launch/index.html node launch/render.mjs
```

The renderer samples a deterministic 41-second timeline at 30 fps, 1920×1080.
It exports keyframes, a silent H.264 film, a music version with AAC, the original
synthesized score, a naming-study still and a manifest. Audio is normalized to
−18 LUFS with a −1.5 dBTP target. No third-party music or samples are included.

| Time | Beat | Evidence boundary |
| --- | --- | --- |
| 0–4 | Keep the relationship. Lose the upkeep. | Product promise |
| 4–12 | Ask the coding agent; inspect the call source | Illustrative external chat |
| 12–16 | Read and approve the proposed task | Individual task approval |
| 16–22 | Action count changes; source stays attached | Synthetic 2 → 3 task count |
| 22–29 | Open code, local records, chosen agent | README and workspace contract |
| 29–35 | Feedback → reviewed handoff → product work | No automatic remote submission |
| 35–41 | Product identity and repository destination | Launch CTA |

The film is an illustrative narrative, not proof of an autonomous live run.
No actual customer records, chat transcripts or private product code are used.
An agent can prepare a task through CLI/MCP and the user can approve it under
Review. The demo does not imply automatic sends, bulk approvals, automatic
releases, or a working cloud feedback connection.

Before distribution: inspect all keyframes at export size, verify audio and
video decoding, watch the full cut with sound, confirm the release destination
is public and works, and close the blockers in `docs/release-readiness.md`.
The earlier real-product demonstration remains suitable for a README embed.
