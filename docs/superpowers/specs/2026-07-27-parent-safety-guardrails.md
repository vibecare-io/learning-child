# Parent Safety & Control (roadmap spec)

Status: **roadmap / not v1.** Two related parent-control capabilities:

1. **Anti-addiction guardrails** — the addiction patterns parents worry about, which our
   curation defuses *structurally* vs. which need *active* controls (time limits, session
   caps, reporting).
2. **Remote intervention** — a parent, seeing/hearing a kid watching junk, pushes good
   content to the kid's device *live, from their own phone* (see the section below).

## Why this is a separate concern from curation

Curation controls **what** a kid sees. It does nothing about **how much** or **how**.
A child can watch nothing but excellent science videos and still binge four hours,
rabbit-hole a single channel, and consume passively at 2× while skipping every idea.
The dopamine machinery — infinite feed, autoplay, thumbnails, notifications — is a
*delivery-mechanism* problem, orthogonal to content quality. This spec is that half.

## The patterns parents must be worried about

Grouped by mechanism. The **Status** column is honest about what the extension does today.

### A. Time & volume

| # | Pattern | What it looks like | Status today |
|---|---------|--------------------|--------------|
| A1 | **Binge / marathon** | One sitting runs past ~1–2h with no natural stop | ❌ not tracked |
| A2 | **Total daily overrun** | Small sessions all day sum to hours | ❌ not tracked |
| A3 | **Off-limits time** | Watching at bedtime, during meals, during school hours | ❌ not tracked |
| A4 | **Session frequency / checking** | Opens YouTube dozens of times a day (compulsive checking) | ❌ not tracked |

### B. Feed & format mechanics

| # | Pattern | What it looks like | Status today |
|---|---------|--------------------|--------------|
| B1 | **Short-form doomscroll** | Swiping Shorts/Reels, infinite sub-60s dopamine hits | ✅ Shorts shelves/nav hidden; direct `/shorts` capped at 5 then exponential cooldown |
| B2 | **Autoplay rabbit hole** | "Up next" chains video → video unattended | ✅ up-next removed; autoplay toggled off |
| B3 | **Algorithmic drift** | Starts educational, algo drifts to unboxing / reaction / rage-bait | ✅ no algo feed — curated grid only |
| B4 | **Thumbnail/clickbait chasing** | Clicking the most sensational thumbnail, escalation | ⚠️ partial — curated thumbs, but thumbs still exist |

### C. Attention & consumption quality

| # | Pattern | What it looks like | Status today |
|---|---------|--------------------|--------------|
| C1 | **Single-channel / rewatch fixation** | Same video or one channel on loop; exploration narrows | ❌ not tracked (feed *encourages* breadth but doesn't detect fixation) |
| C2 | **Skip / speed / never-finish** | Skips around, 2× everything, abandons before the idea lands | ❌ not tracked |
| C3 | **Passive-only consumption** | Hours watched, nothing made or done | ❌ out of scope (needs off-platform signal) |

### D. Engagement & pull-back hooks

| # | Pattern | What it looks like | Status today |
|---|---------|--------------------|--------------|
| D1 | **Notifications / FOMO** | Bell + "creator posted" nudges drag them back | ✅ notification bell hidden |
| D2 | **Engagement bait** | "like & subscribe", comment farming, merch/loot pushes | ✅ comments hidden; ⚠️ in-video CTAs remain |

**Takeaway:** our curation model already *structurally* kills most of section B and D
(no infinite feed, no autoplay chain, no algo drift, no notifications, no comments).
The real gap — and the todo — is **section A (time/volume) and C (consumption quality)**,
which need active tracking plus a parent-facing report.

## Proposed controls (the todo)

Roughly in build order, cheapest/highest-leverage first.

1. **Daily time budget** — parent sets minutes/day per profile. Extension tracks
   foreground watch time (video actually playing, tab visible); soft warning at 80%,
   gentle full-screen "that's a wrap for today" at 100%. Fail-open stays the rule:
   this nudges, it doesn't hard-lock (a determined kid can remove the extension — see
   the main spec's honest-limits section).
2. **Session length cap** — after N continuous minutes, a "stretch break" interstitial
   (breathing, look-away, or a "come back in 10 min" cooldown). Targets A1.
3. **Allowed-hours window** — per-profile schedule (e.g. no watching after 8pm, none
   9am–3pm on school days). Targets A3.
4. **Parent watch report** — the honest, non-creepy version of "stats": minutes/day,
   videos finished vs. abandoned, topic spread (are they exploring or fixating?),
   longest session. Local-first (stored in extension storage, shown in the popup);
   no backend, no third party. Targets A2/A4/C1 by *surfacing* them to the parent.
5. **Fixation nudge** — if the same channel dominates a day, the feed gently
   over-weights an unseen topic tomorrow (breadth as an antidote). Targets C1.
6. **Finish-rate signal** — track finished vs. skipped-away to flag C2 in the report;
   don't police it, just show it.

### Shipped: reels budget (B1 backstop) ✅

Hiding the Shorts shelves defuses B1 for the normal path, but a kid who types
`/shorts` or follows an external link lands in the doomscroll anyway. Rather than
a hard redirect (teaches nothing, invites a workaround), the extension allows a
small taste — **5 reels** — then redirects home and starts a cooldown that grows
**exponentially** each time the cap is hit again (5m → 10m → 20m → …, capped at
4h). A live countdown bar at the top of the page shows the remaining cooldown; a
long clean gap (12h) forgives the escalation and resets the count. Fail-open as
always: it nudges, it doesn't lock. Lives in `extension/src/reels-guard.ts` with
the pure budget/cooldown logic unit-tested; wired into `content.ts`'s shorts
route. State is local-only (`chrome.storage.local`, key `reelsGuard`) — nothing
about the child's reel-watching leaves the device.

The **limit** and **first-break length** are parent-tunable in the PIN-gated
Parent controls (settings panel), stored on `ParentControls` — defaults 5 reels /
5 min. Setting the limit to **0** blocks Shorts outright (the old hard-redirect,
no timed cooldown). The escalation cap (4h) and decay window (12h) stay internal.

Explicitly **not** doing: keystroke/behavior surveillance, uploading a child's watch
history anywhere, or hard device lockout (that belongs to OS/Chrome managed policies,
not a fail-open content extension).

## Remote intervention — live curation push

The scenario: a parent walks past, **sees or hears** the kid watching something silly,
and wants to *replace it right now* — from their own phone, without touching the kid's
device or waiting for a nightly catalog rebuild. This graduates the product from a static
published catalog to a **live parent↔child link**.

### Modes of intervention

1. **Replace now** — parent picks a good video; the kid's active tab redirects to it.
   The immediate "cut the junk" action.
2. **Swap the menu** — parent pins a topic or pushes a fresh curated set for the rest of
   the day; the home grid re-renders to it. (Reuses the existing chip/feed machinery.)
3. **Lights-out** — remote "that's enough for now" screen. Shared with the time-budget
   guardrail (A1/A2) — same interstitial, parent-triggered instead of timer-triggered.

### How the channel works (options, cheapest first)

| Option | Infra | Latency | Trade-off |
|--------|-------|---------|-----------|
| **A. `chrome.storage.sync`** | none | seconds | Only works if the *same Google account* is signed into Chrome on both ends — rarely true for a parent's phone. Zero-infra but narrow. |
| **B. Polled shared store** | 1 tiny hosted key-value (Cloudflare KV / a private Gist) | ~poll interval (10–15s) | Simplest real cross-device path. Extension polls a family key; parent's page writes to it. |
| **C. Realtime channel** | Worker + Durable Object / Firebase RTDB (SSE or WebSocket) | ~instant | Best UX, most infra. Warranted only once B proves the flow. |

Recommended path: **B first** (poll a family key), graduate to **C** if the seconds of
lag matter. A one-time **pairing code** binds the kid's device to the family channel.

### The privacy line (important — it does *not* contradict "never phones home")

The guardrail/stats side is **local-first**: the kid's *behavior data* (minutes, finish
rates, fixation) never leaves the device. Remote intervention is the opposite direction —
a **command channel** carrying only the *parent's chosen* video IDs / topic picks *down*
to the kid. Parent intent flows in; child data does **not** flow out. That asymmetry is
the whole trust model: we sync what the parent decides, never what the child does.

### Kid-side UX — the attribution trap

Naive design: a "Dad picked something for you 🎈" card. **This backfires.** Attributing
the swap to a parent creates two things that didn't exist before: a *villain* to appeal
to and an *override* to negotiate. "Dad picked this" literally invites "Dad, undo it."
The card teaches the kid that the good content is an imposition and that Dad is the
gatekeeper to route around.

The fix is not better card copy — it's removing the attribution and the yank. **Stop
pushing content *at* the kid; change what the environment naturally offers.** A kid runs
to a parent when something was *done to them*, not when the feed simply refreshed.

Design rules for a tactful swap:

1. **No attribution — invisible hand.** The swap just *is* the feed; no "someone did
   this," no target for an appeal. The parent still sees the intervention in their log;
   the kid never sees a culprit. (This is the digital version of what every parent
   already does by choosing what's in the house.)
2. **Choice, not assignment.** Surface 2–3 curated options and let the kid *pick*.
   Autonomy is the antidote to resistance (self-determination theory): the parent
   constrains the set — all good — the kid owns the choice. "Pick one" doesn't trigger
   the rebellion that "here's your video" does.
3. **Pull with curiosity, don't shove.** The replacement wins by being *more
   interesting* (a hook, an open question), not by being mandated. Kids follow curiosity.
4. **Wait for the gap.** Swap at a natural break (video end / up-next moment), never
   mid-sentence. Interrupting *flow* is what manufactures the grievance.
5. **Bridge from where they are.** Silly cat clip → a great animal/nature video.
   "More like this" feels organic; a hard topic-jump feels corrective.
6. **Never a shame frame.** The old content just stops being foregrounded; the new
   content gets the spotlight. No "that was bad" — absence of a scold means nothing to
   rebel against.

Mode-dependence: "replace now" is deliberately interruptive (used sparingly, at the gap);
"swap the menu" is quiet and needs no card at all — tomorrow's grid is simply better.

### The honest boundary — internalize, don't just conceal

The aim is not "engineer it so the kid never comes to the parent." That's a covert-control
arms race, and kids are sharp — the day they notice, they distrust the whole environment.
The durable goal is the kid **internalizing good taste**. So: *invisible in the moment,
occasionally transparent by design* — "we set your channels up together" framed as a proud,
shared thing, not a secret to protect. Environment-shaping that graduates into the child's
own judgment beats a swap that must never be discovered. Design for the former.

### Fail-open, as always

If the channel is unreachable, the kid keeps the last good catalog and nothing breaks —
identical to the catalog-fetch-fails path in the main spec.

## Design principles for these guardrails

- **Nudge, don't jail.** We shape defaults and surface reality; we don't pretend to
  be an unbreakable lock. Consistent with the fail-open philosophy.
- **Local-first, private.** Time/behavior data never leaves the device. A stats
  feature that phones home would betray the exact trust this product is built on.
- **Show the parent, don't shame the kid.** Reports are for the adult conversation,
  not an on-screen scold.
- **Breadth is the medicine.** Where possible, the answer to a bad pattern is more
  variety in tomorrow's feed, not just a blocker.

## Open questions

- Watch-time accounting: count only while the player is `playing` + tab visible?
  How to handle background audio / picked-up-and-put-down?
- Where do per-profile limits live — `catalog.yaml`, a separate `guardrails.yaml`,
  or the extension popup? (Popup is friendlier than YAML for a time slider.)
- Do we need a parent PIN to change limits, or is honor-system fine for v-next?
