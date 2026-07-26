# Research Brief: Best YouTube Channels for Kids' Brain Development

> **For a single research agent.** This brief is self-contained: read it top to bottom,
> then execute. Your deliverable feeds directly into `catalog-pipeline/catalog.yaml`
> (schema below) for the Learning Child project — a Chrome extension that replaces
> YouTube's algorithmic recommendations with a parent-curated catalog.
> Project context: `docs/superpowers/specs/2026-07-26-kids-youtube-curation-design.md`.

## Mission

Produce a vetted, justified list of **30–50 YouTube channels** (plus notable playlists)
that genuinely develop kids' curiosity and thinking — science, maths, space, music,
exploration, engineering, nature, history — split across two age profiles:

- **`little`** — ages 3–7: gentle pacing, concrete concepts, warm presenters, safe humor.
- **`big`** — ages 8–12: real explanations, experiments, "how things work," deeper rabbit
  holes that reward attention rather than hijack it.

## What "good" means here (the quality bar)

Score every candidate against these. A channel must clear ALL hard requirements and
most soft ones.

**Hard requirements:**
1. **Teaches something real.** After a video, a kid knows/can-do/wonders something new.
   Edutainment is fine; empty stimulation is not.
2. **No dopamine-bait format.** Reject channels whose style is: screaming thumbnails,
   1-second cuts, sirens/alarm sounds, "YOU WON'T BELIEVE," mystery-box/prank/reaction
   formats — even if nominally "educational."
3. **Long-form.** Mostly videos over ~3 minutes. (The pipeline drops <120s uploads, so a
   Shorts-only channel contributes nothing.)
4. **Active or evergreen.** Either still uploading, or a finished library that stays
   excellent (e.g., a completed series counts).
5. **Advertiser-safe for kids.** No profanity, violence, innuendo, or sponsor segments
   for adult products in the typical video.

**Soft criteria (grade A/B/C):**
- Production and explanation quality (clear narration, accurate content)
- Sparks follow-up questions vs. closes them ("try this at home" energy)
- Presenter warmth / respect for the audience (doesn't talk down to kids)
- Consistency across the catalog (spot-check 3+ videos, not just the hits)
- Reputation: cited by teachers, Common Sense Media, science-communication communities

## Method

1. **Sweep broadly.** Cross-reference multiple source types so one lens doesn't dominate:
   - "Best educational YouTube channels for kids" roundups (teacher blogs, STEM orgs)
   - Common Sense Media reviews and similar kid-media evaluators
   - Reddit/HN threads where parents and educators compare notes
   - "Channels like X" expansions from known-good anchors (Kurzgesagt, Veritasium,
     3Blue1Brown, SciShow Kids, Mystery Doug, TED-Ed, Crash Course Kids, Numberphile,
     Mark Rober, Smarter Every Day, Nat Geo Kids, Storybots, Physics Girl, MinutePhysics,
     Primitive Technology, Peekaboo Kidz, Maddie Moate, Operation Ouch)
2. **Verify each candidate on YouTube itself** (this step is mandatory, not optional):
   - Confirm the **exact @handle** exists and is the real channel (imitators are common).
   - Spot-check 3 recent videos + 1 popular video against the quality bar.
   - Note typical video length, upload cadence, and whether content skews `little`/`big`/both.
3. **Balance the portfolio.** Target rough coverage — science ~30%, maths ~10%,
   space ~10%, music ~10%, nature/exploration ~15%, engineering/making ~15%,
   history/geography/misc ~10%. At least 10 channels must fit profile `little`.
4. **Cut ruthlessly.** A shorter list parents trust beats a padded one. If unsure, put
   the channel in the "borderline" section with the reason, don't force it in.

## Deliverable

A single markdown file: `docs/research/2026-07-26-channel-research-results.md` with:

**1. Ready-to-paste YAML** — the main output, valid against this exact schema:

```yaml
sources:
  - channel: "@exact-handle"     # verified on youtube.com
    topics: [science]            # from: science, maths, space, music, nature,
                                 #       exploration, engineering, history, geography
    profiles: [big]              # [little], [big], or [little, big]
  # playlists only when a channel is mixed but one playlist is gold:
  - playlist: "PLxxxxxxxx"
    topics: [music]
    profiles: [little]

search_only_channels:            # fine to find via search, not pushed into the feed
  - "@borderline-but-safe-channel"
```

**2. Justification table** — one row per channel: handle, name, topics, profiles,
grade (A/B), one-sentence why-it's-in, typical video length, upload cadence.

**3. Borderline/rejected list** — channels a parent might expect to see, with the
one-line reason they didn't make the cut (e.g., "great content but Shorts-dominated",
"drifted into reaction content since 2024"). This saves the parents from re-litigating.

**4. Coverage gaps** — topics/age-bands where you couldn't find enough A-grade channels,
so parents know where the catalog is thin.

## Rules

- **Never invent a handle.** Every `@handle` must have been seen on youtube.com during
  verification. A wrong handle silently breaks the catalog build.
- Prefer the channel's handle over channel-ID URLs (handles are what the YAML takes).
- Non-English channels are welcome as a bonus section if clearly excellent, but the
  main list is English-language.
- Keep personal-brand kidfluencer channels (toy unboxing, family vlogs) out entirely,
  regardless of popularity.
