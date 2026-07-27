# Channel Research Results — Kids YouTube Curation

**Date:** 2026-07-26
**Brief:** `docs/research/2026-07-26-channel-research-brief.md`
**Method:** 10 parallel domain research agents (science, space, maths, music, art/making,
nature/animals, engineering, history/geography, reading, coding). ~130 candidates surfaced,
handle-verified on YouTube, then deduped and cut to the list below.

## Topic vocabulary

The brief's vocabulary — `science, maths, space, music, nature, exploration, engineering,
history, geography` — extended with three creativity tags the project explicitly wants:
`art, making, coding`. Plus `animals`, `reading`, `tech` for precision. `experiments` was
folded into `science`.

## Age profiles

- **`little`** — ages 3–7
- **`big`** — ages 8–12

---

## 1. Ready-to-paste YAML

> Paste the `sources:` and `search_only_channels:` blocks under the `profiles:` block in
> `catalog-pipeline/catalog.yaml`. Every handle below was verified on youtube.com during
> research. Handles that could not be fully confirmed are **not** in this list — they are in
> §3 (Borderline) with the reason.

```yaml
sources:
  # ---------- SCIENCE ----------
  - channel: "@SciShowKids"
    topics: [science]
    profiles: [little]
  - channel: "@freeschool"
    topics: [science, nature, space]
    profiles: [little, big]
  - channel: "@PeekabooKidz"
    topics: [science, space]
    profiles: [little, big]
  - channel: "@GenerationGenius"
    topics: [science]
    profiles: [little, big]
  - channel: "@crashcoursekids"
    topics: [science, space]
    profiles: [little, big]
  - channel: "@sickscience"
    topics: [science, making]
    profiles: [little, big]
  - channel: "@SteveMould"
    topics: [science]
    profiles: [big]
  - channel: "@TheActionLab"
    topics: [science]
    profiles: [big]
  - channel: "@besmart"
    topics: [science]
    profiles: [big]
  - channel: "@journeytomicro"
    topics: [science, nature]
    profiles: [big]

  # ---------- SPACE ----------
  - channel: "@NASA"
    topics: [space, exploration]
    profiles: [little, big]
  - channel: "@NASAJPL"
    topics: [space, engineering]
    profiles: [big]
  - channel: "@EuropeanSpaceAgency"
    topics: [space]
    profiles: [big]
  - channel: "@kurzgesagt"
    topics: [space, science]
    profiles: [big]
  - channel: "@astrumspace"
    topics: [space, exploration]
    profiles: [big]
  - channel: "@MinuteEarth"
    topics: [nature, science, geography]
    profiles: [little, big]

  # ---------- MATHS ----------
  - channel: "@Numberblocks"
    topics: [maths]
    profiles: [little]
  - channel: "@KhanAcademyKids"
    topics: [maths, reading]
    profiles: [little]
  - channel: "@numberockllc"
    topics: [maths, music]
    profiles: [little, big]
  - channel: "@numberphile"
    topics: [maths]
    profiles: [big]
  - channel: "@3blue1brown"
    topics: [maths]
    profiles: [big]
  - channel: "@mathantics"
    topics: [maths]
    profiles: [big]
  - channel: "@teded"
    topics: [maths, science]
    profiles: [big]

  # ---------- MUSIC ----------
  - channel: "@SuperSimpleSongs"
    topics: [music]
    profiles: [little]
  - channel: "@TheLaurieBerknerBand"
    topics: [music]
    profiles: [little]
  - channel: "@carnegiehallkids"
    topics: [music]
    profiles: [little, big]
  - channel: "@MrHenrysMusicWorld"
    topics: [music]
    profiles: [little, big]
  - channel: "@philharmonia_orchestra"   # canonical handle (was @Philharmonia)
    topics: [music]
    profiles: [little, big]
  - channel: "@SoundFieldPBS"
    topics: [music, history]
    profiles: [big]
  - channel: "@andrewhuang"
    topics: [music, making]
    profiles: [big]
  - channel: "@NahreSol"
    topics: [music, making]
    profiles: [big]

  # ---------- ART & MAKING ----------
  - channel: "@artforkidshub"
    topics: [art, making]
    profiles: [little, big]
  - channel: "@DrawSoCute"
    topics: [art, making]
    profiles: [little, big]
  - channel: "@SuperSimpleDraw"
    topics: [art, making]
    profiles: [little]
  - channel: "@cartooningclub"
    topics: [art, making]
    profiles: [big]
  - channel: "@Jazza"
    topics: [art, making]
    profiles: [big]
  - channel: "@redtedart"
    topics: [making, art]
    profiles: [little, big]
  - channel: "@jonakashima"
    topics: [making, art]
    profiles: [big]
  - channel: "@paperkawaii"
    topics: [making, art]
    profiles: [little, big]
  - channel: "@TheDadLab"
    topics: [making, science]
    profiles: [little, big]
  - channel: "@Babbledabbledo"
    topics: [making, art, engineering]
    profiles: [little, big]
  - channel: "@Artfulparent1"
    topics: [art, making]
    profiles: [little]

  # ---------- NATURE & ANIMALS ----------
  - channel: "@BBCEarthKids"
    topics: [nature, animals]
    profiles: [little, big]
  - channel: "@EVNautilus"                # Nautilus Live (was @NautilusLive)
    topics: [nature, exploration]
    profiles: [little, big]
  - channel: "@MontereyBayAquarium"
    topics: [animals, nature]
    profiles: [little, big]
  - channel: "@SanDiegoZooKidsTV"
    topics: [animals, nature]
    profiles: [little]
  - channel: "@MaddieMoate"
    topics: [science, nature]
    profiles: [little, big]
  - channel: "@KQEDDeepLook"
    topics: [animals, science]
    profiles: [big]
  - channel: "@epicgardening"
    topics: [nature, making]
    profiles: [big]

  # ---------- ENGINEERING ----------
  - channel: "@KidsInventStuff"
    topics: [engineering, making]
    profiles: [little, big]
  - channel: "@HandymanHal"
    topics: [making, engineering]
    profiles: [little]
  - channel: "@MarkRober"
    topics: [engineering, science, making]
    profiles: [big]
  - channel: "@JaredOwen"
    topics: [engineering, tech]
    profiles: [big]
  - channel: "@BranchEducation"
    topics: [engineering, tech]
    profiles: [big]
  - channel: "@PracticalEngineeringChannel"
    topics: [engineering]
    profiles: [big]
  - channel: "@smartereveryday"
    topics: [science, engineering]
    profiles: [big]
  - channel: "@DesignSquadGlobal"
    topics: [engineering, making]
    profiles: [big]
  - channel: "@Wintergatan"
    topics: [engineering, music, making]
    profiles: [big]

  # ---------- HISTORY & GEOGRAPHY ----------
  - channel: "@natgeokids"
    topics: [geography, nature, animals]
    profiles: [little, big]
  - channel: "@HomeschoolPop"
    topics: [history, geography]
    profiles: [little, big]
  - channel: "@GeographyNow"
    topics: [geography, exploration]
    profiles: [big]
  - channel: "@SmithsonianChannel"
    topics: [history, exploration]
    profiles: [big]
  - channel: "@toldinstone"
    topics: [history]
    profiles: [big]
  - channel: "@britishmuseum"
    topics: [history, art]
    profiles: [big]
  - channel: "@Langfocus"
    topics: [geography]
    profiles: [big]

  # ---------- READING & LANGUAGE ----------
  - channel: "@StorylineOnline"
    topics: [reading]
    profiles: [little, big]
  - channel: "@BrightlyStorytime"
    topics: [reading]
    profiles: [little]
  - channel: "@kidtimestorytime"
    topics: [reading]
    profiles: [little]
  - channel: "@VooksStorybooks"
    topics: [reading]
    profiles: [little]
  - channel: "@officialalphablocks"
    topics: [reading]
    profiles: [little]
  - channel: "@JackHartmann"
    topics: [reading, music, maths]
    profiles: [little]
  - channel: "@MichaelRosenOfficial"
    topics: [reading]
    profiles: [little, big]
  - channel: "@RobWords"
    topics: [reading]
    profiles: [big]

  # ---------- CODING & TECH ----------
  - channel: "@codeorg"
    topics: [coding, tech]
    profiles: [little, big]
  - channel: "@codeSparkFOOtubeKids"
    topics: [coding]
    profiles: [little]
  - channel: "@ScratchTeam"
    topics: [coding, making]
    profiles: [big]
  - channel: "@griffpatch"
    topics: [coding, making]
    profiles: [big]
  - channel: "@TheCodingTrain"
    topics: [coding, making, art]
    profiles: [big]
  - channel: "@AutodeskTinkercad"
    topics: [making, coding, engineering]
    profiles: [big]
  - channel: "@Computerphile"
    topics: [tech, coding]
    profiles: [big]
  - channel: "@crashcourse"
    topics: [tech, coding]
    profiles: [big]

search_only_channels:
  # Excellent but advanced, intense, or better-pulled-on-demand than pushed into a young
  # feed. Allowed in filtered search results, not front-loaded in the homepage grid.
  - "@BBCEarth"                 # world-class, but frequent predation footage — big-leaning
  - "@NatGeo"                   # explorers + wildlife, some peril/predation
  - "@BraveWilderness"          # intense stings/venom demos, gross-out for sensitive kids
  - "@AntsCanada"               # long binge-y narrative; ants eat live prey
  - "@pbsspacetime"             # rigorous astrophysics, best for advanced 11-12
  - "@whatdamath"               # daily real astronomy news, advanced
  - "@Mathologer"               # deep proofs, challenging even for keen bigs
  - "@CrackingTheCryptic"       # long-form daily sudoku solves, older bigs
  - "@misterwootube"            # filmed secondary-school lessons; upper big
  - "@StuffMadeHere"            # heavy power tools, dry adult humor — watch-not-imitate
  - "@Computerphile"            # (also above) topic-led, not a course
  - "@Simplehistory"            # animated history, heavy WWII/combat — flag war themes
  - "@KingsandGenerals"         # military history, battles/violence throughout
  - "@extrahistory"             # war/political violence in some sagas
  - "@RealLifeLore"             # geopolitics/conflict framing
  - "@FallofCivilizations"      # very long; famine/collapse/violence themes
  - "@HorribleHistoriesOfficial" # comic gross-out + mild violence; older littles w/ parent
  - "@OverlySarcasticProductions" # sarcastic tone, mature myth themes — older bigs
  - "@twosetviolin"             # comedy + real playing; mild teen humor
  - "@AdamNeely"                # advanced theory essays; upper bigs
  - "@scratchfoundation"        # inspirational/community, less how-to than @ScratchTeam
```

---

## 2. Justification table (main list)

Grade: **A** = flagship, put it in the feed with confidence · **B** = strong, minor caveat.
Cadence/length are approximate, from spot-checks during research.

| Handle | Name | Topics | Profiles | Grade | Why it's in | Length | Cadence |
|---|---|---|---|---|---|---|---|
| @SciShowKids | SciShow Kids | science | little | A | Answers the "why?" littles actually ask, with simple try-it demos | 3–5m | weekly |
| @freeschool | Free School | science, nature, space | little, big | A | Calm, wonder-first tours of the natural world for the youngest | 5–10m | evergreen |
| @PeekabooKidz | Dr. Binocs Show | science, space | little, big | B | Punchy animated "how it works" bites; energetic but not bait | 3–6m | active |
| @GenerationGenius | Generation Genius | science | little, big | A | Standards-aligned science with real hosts + kid experiments | 5–12m | active |
| @crashcoursekids | Crash Course Kids | science, space | little, big | A | Real Earth/space concepts in fast, funny sub-4-min lessons | ~4m | evergreen |
| @sickscience | Sick Science! | science, making | little, big | B | Silent do-it-at-home experiment demos invite recreation | 1–5m | evergreen |
| @SteveMould | Steve Mould | science | big | A | Chases genuinely surprising physics with "wait, why?" energy | 10–20m | active |
| @TheActionLab | The Action Lab | science | big | B | Vivid real "what if" experiments; watch-not-copy | 5–12m | active |
| @besmart | Be Smart (PBS) | science | big | A | "The pleasure of finding things out" for curious 8–12s | ~10m | active |
| @journeytomicro | Journey to the Microcosmos | science, nature | big | A | Meditative microscopy opens an invisible living universe | 8–15m | active |
| @NASA | NASA | space, exploration | little, big | A | Real rockets, rovers, astronauts — wonder made official | varies | active |
| @NASAJPL | NASA JPL | space, engineering | big | A | Behind-the-scenes of building Mars rovers → "how'd they DO that?" | 3–15m | active |
| @EuropeanSpaceAgency | ESA | space | big | B | A non-US window on missions + Earth-from-space awe | varies | active |
| @kurzgesagt | Kurzgesagt | space, science | big | A | Gorgeous animation reframing the scale of the universe | 8–15m | active |
| @astrumspace | Astrum | space, exploration | big | A | Calm cinematic tours of real planets/moons imagery | 15–25m | active |
| @MinuteEarth | MinuteEarth | nature, science, geography | little, big | A | Quick hand-drawn answers to everyday Earth-science "why?"s | ~3m | active |
| @Numberblocks | Numberblocks | maths | little | A | The rare maths show built for 3–7: number sense as play | 5m | evergreen |
| @KhanAcademyKids | Khan Academy Kids | maths, reading | little | A | Gentle counting/shapes/early-number adventures | short | active |
| @numberockllc | NUMBEROCK | maths, music | little, big | A | Catchy songs make skip-counting/fractions stick | 2–4m | active |
| @numberphile | Numberphile | maths | big | A | Mathematicians geek out over numbers like adventure stories | 10–20m | active |
| @3blue1brown | 3Blue1Brown | maths | big | A | Animated visualizations make abstract ideas click and feel beautiful | 15–25m | monthly |
| @mathantics | Math Antics | maths | big | B | Warm, clear walkthroughs make kids feel capable, not stuck | <10m | occasional |
| @teded | TED-Ed | maths, science | big | A | Animated logic riddles turn deduction into a game kids beg to pause | 4–6m | active |
| @SuperSimpleSongs | Super Simple Songs | music | little | A | Thoughtful original singalongs made by former music teachers | 2–4m | active |
| @TheLaurieBerknerBand | Laurie Berkner Band | music | little | A | Real live-band performances model genuine musicianship | 2–4m | monthly |
| @carnegiehallkids | Carnegie Hall Kids | music | little, big | A | Instruments + world genres from a world-class institution | short | active |
| @MrHenrysMusicWorld | Mr. Henry's Music World | music | little, big | B | A music teacher makes theory/rhythm playable — lesser-known gem | 5–10m | active |
| @Philharmonia | Philharmonia Orchestra | music | little, big | A | Pro players demo each instrument up close | 3–8m | evergreen |
| @SoundFieldPBS | Sound Field | music, history | big | A | Unpacks the theory + culture behind why music works | 10–15m | active |
| @andrewhuang | Andrew Huang | music, making | big | B | Turns anything into music — sound as a limitless playground | 5–12m | active |
| @NahreSol | Nahre Sol | music, making | big | A | Shows the creative process of composing across styles | 8–15m | active |
| @artforkidshub | Art for Kids Hub | art, making | little, big | A | 3,000+ follow-along draw-alongs; the gold standard | 5–15m | ~daily |
| @DrawSoCute | Draw So Cute | art, making | little, big | A | Slow stroke-for-stroke tutorials kids can finish | 8–15m | weekly |
| @SuperSimpleDraw | Super Simple Draw! | art, making | little | A | Gentle shape-based draw-alongs for the youngest | 5–8m | active |
| @cartooningclub | Cartooning Club | art, making | big | B | Clear numbered steps build skill + focus (some licensed chars) | 5–15m | daily |
| @Jazza | Jazza | art, making | big | B | Pro technique + wild supply experiments; preview mild humor | 10–20m | weekly |
| @redtedart | Red Ted Art | making, art | little, big | A | Endless easy crafts from household junk | 3–8m | active |
| @jonakashima | Origami w/ Jo Nakashima | making, art | big | A | Precise calm folds teach patience + spatial reasoning | 5–15m | active |
| @paperkawaii | Paper Kawaii | making, art | little, big | B | No-glue origami; many true-beginner projects — gem | 5–15m | active |
| @TheDadLab | TheDadLab | making, science | little, big | A | Simple science toys from home materials, do-it-together | 3–8m | weekly |
| @Babbledabbledo | Babble Dabble Do | making, art, engineering | little, big | B | STEAM art-meets-science builds — creative-family gem | varies | occasional |
| @Artfulparent1 | The Artful Parent | art, making | little | B | Open-ended process art for early years | short | active |
| @BBCEarthKids | BBC Earth Kids | nature, animals | little, big | A | World-class wildlife footage pitched at young curiosity | 3–8m | weekly |
| @NautilusLive | Nautilus Live | nature, exploration | little, big | A | Live ROV deep-sea dives; scientists' contagious wonder | varies | active |
| @MontereyBayAquarium | Monterey Bay Aquarium | animals, nature | little, big | A | Otters/jellies up close; calm, predation-light | short | active |
| @SanDiegoZooKidsTV | San Diego Zoo Kids | animals, nature | little | A | Zookeeper close-ups built for young kids; no predation | short | active |
| @MaddieMoate | Maddie Moate | science, nature | little, big | A | Warm host chasing "why?" — ideal little→big bridge | 8–15m | active |
| @KQEDDeepLook | Deep Look | animals, science | big | A | 4K macro makes a mosquito an alien marvel; look closer | 3–6m | active |
| @epicgardening | Epic Gardening | nature, making | big | B | Growing food as replicable experiments; parent-and-kid projects | 5–12m | active |
| @KidsInventStuff | Kids Invent Stuff | engineering, making | little, big | A | Real engineers build ideas sent in by 4–11-year-olds | 8–15m | monthly |
| @HandymanHal | Handyman Hal | making, engineering | little | B | Friendly tool/vehicle exploration for preschoolers | 8–15m | active |
| @MarkRober | Mark Rober | engineering, science, making | big | A | Ex-NASA builds model the prototype→test→iterate loop | 15–20m | monthly |
| @JaredOwen | Jared Owen | engineering, tech | big | A | 3D cutaways make invisible mechanisms visible | 10–15m | active |
| @BranchEducation | Branch Education | engineering, tech | big | A | Detailed teardowns of the tech kids use daily | 10–15m | infrequent |
| @PracticalEngineeringChannel | Practical Engineering | engineering | big | A | Demystifies bridges/dams/grids with tabletop models | 10–15m | active |
| @smartereveryday | SmarterEveryDay | science, engineering | big | A | Slow-mo + experts model relentless curiosity (preview a few) | 10–20m | active |
| @DesignSquadGlobal | Design Squad Global | engineering, making | big | B | PBS kids + engineers on safe household-material builds | varies | low |
| @Wintergatan | Wintergatan | engineering, music, making | big | A | Marble-machine build diaries fuse mechanics + music + iteration | 10–20m | active |
| @natgeokids | Nat Geo Kids | geography, nature, animals | little, big | A | Short colorful trips to real places/cultures | 2–6m | active |
| @HomeschoolPop | Homeschool Pop | history, geography | little, big | B | Gentle grade-level intros to continents/countries/history | 5–15m | active |
| @GeographyNow | Geography Now | geography, exploration | big | A | Every country's land/flags/food/people — builds a world map | 15–25m | active |
| @SmithsonianChannel | Smithsonian Channel | history, exploration | big | B | Museum-grade docs; preview individual episodes | varies | active |
| @toldinstone | toldinstone | history | big | A | Specific "daily life in ancient Rome" questions; calm, non-graphic | 8–15m | active |
| @britishmuseum | The British Museum | history, art | big | B | Curators unpack real ancient objects — "Curator's Corner" gem | 5–15m | active |
| @Langfocus | Langfocus | geography | big | B | The world's languages + the cultures behind them | 10–20m | active |
| @StorylineOnline | Storyline Online | reading | little, big | A | Actors read quality picture books over the real illustrations | 5–15m | irregular |
| @BrightlyStorytime | Brightly Storytime | reading | little | A | Warm full read-alouds of well-chosen picture books | 5–10m | weekly |
| @kidtimestorytime | KidTimeStoryTime | reading | little | B | Puppets + voices turn books into lively performances | 5–15m | frequent |
| @VooksStorybooks | Vooks | reading | little | B | Gently animated storybooks with on-screen text for emerging readers | 3–8m | active |
| @officialalphablocks | Alphablocks | reading | little | A | Phonics through playful letter-character story logic | 5m | evergreen |
| @JackHartmann | Jack Hartmann | reading, music, maths | little | A | Movement songs drill letter sounds/sight words/counting | 2–5m | very active |
| @MichaelRosenOfficial | Michael Rosen | reading | little, big | A | The "Bear Hunt" author performs his own funny rhythmic poems | 2–8m | active |
| @RobWords | RobWords | reading | big | A | Where English words come from — feeds a love of language | 8–15m | active |
| @codeorg | Code.org | coding, tech | little, big | A | Themed first-coding intros + friendly "how computers work" | varies | active |
| @codeSparkFOOtubeKids | codeSpark | coding | little | B | Word-free coding challenges for pre-readers — rare little coding | short | active |
| @ScratchTeam | Scratch Team | coding, making | big | A | Official Scratch: build your own games/stories/animations | short | sporadic |
| @griffpatch | griffpatch | coding, making | big | A | Step-by-step Scratch game builds turn players into makers | 15–40m | weekly |
| @TheCodingTrain | The Coding Train | coding, making, art | big | A | Joyful creative-coding → generative art + simulations | 20–40m | active |
| @AutodeskTinkercad | Autodesk Tinkercad | making, coding, engineering | big | B | 3D design + block code + electronics → make real things | 5–15m | active |
| @Computerphile | Computerphile | tech, coding | big | A | How computers actually work — deep curiosity fuel | 8–20m | active |
| @crashcourse | CrashCourse (CS) | tech, coding | big | B | The Computer Science playlist: how computers were invented | 10–12m | evergreen |

---

## 3. Borderline / rejected (with reason)

Kept in `search_only_channels` (allowed in filtered search, not pushed into the feed) or
excluded — so parents don't re-litigate them:

| Handle | Reason |
|---|---|
| @BBCEarth | Flagship, but frequent predation/hunting footage — intense for littles → search-only |
| @NatGeo | Explorers + wildlife with some peril/predation → search-only |
| @BraveWilderness | Intense stings/venom demos, gross-out for sensitive kids → search-only |
| @AntsCanada | Long binge-y narrative; ants eat live prey → search-only |
| @pbsspacetime | Rigorous astrophysics, best for advanced 11–12 only → search-only |
| @whatdamath (Anton Petrov) | Daily real astronomy news; advanced pacing → search-only |
| @Mathologer | Deep proofs, challenging even for keen bigs → search-only |
| @CrackingTheCryptic | Long-form daily sudoku solves; older bigs → search-only |
| @misterwootube (Eddie Woo) | Filmed *secondary-school* lessons; upper big → search-only |
| @StuffMadeHere | Heavy power tools + dry adult humor — inspiration, not follow-along → search-only |
| @Simplehistory | Heavy WWII/combat depictions → search-only, flag war themes |
| @KingsandGenerals | Military history, battles/violence throughout → search-only |
| @extrahistory | War/political violence in some sagas → search-only |
| @RealLifeLore | Geopolitics/conflict framing → search-only |
| @FallofCivilizations | Very long; famine/collapse/violence themes → search-only |
| @HorribleHistoriesOfficial | Comic gross-out + mild violence; older littles with a parent → search-only |
| @OverlySarcasticProductions | Sarcastic tone + mature myth themes; older bigs → search-only |
| @twosetviolin | Comedy + real playing, but mild teen humor → search-only |
| @AdamNeely | Advanced theory essays; upper bigs → search-only |
| @scratchfoundation | Inspirational/community (less how-to than @ScratchTeam) → search-only |
| @physicsgirl (Physics Girl) | Superb evergreen catalog, but channel on hiatus (creator ill); a separate @PhysicsGirlOfficial exists — **verify before adding** |
| @Kodable | Could not confirm exact @handle (channel ID `UCWQyw3c2PphHT8mON5s0hMw`) — **verify or use the ID before build** |
| @HowToClay1 | Handle inferred from a legacy custom URL — **double-check before build** |
| @RobsWorld | Verified only via legacy `/RobsWorld` custom URL — confirm the @handle resolves |
| @mistermaker (Mister Maker) | Legacy `/user/mistermaker` channel — confirm the @handle resolves |
| @philmccordic3490 (Science Max) | Auto-generated-looking handle; real but odd — confirm before build |
| @EtymologyRules | Substantive but low production; smaller channel — optional add |
| @ScratchTeam vs @scratchfoundation | Two real Scratch channels — @ScratchTeam is the how-to one (in main list) |
| Ms Rachel (@msrachel) | Excellent for toddlers but long-form + very popular/algorithm-adjacent — parent's call; left out of the default feed |
| 12tone (@12tone), Rob Scallon (@robscallon) | Great but skew older/teen; optional search-only |
| GoldieBlox (@goldieblox), The Engineering Mindset (@theengineeringmindset) | Mixed branded/advanced content — cherry-pick, left out of default |

**Excluded on principle:** all toy-unboxing, family-vlog, reaction, and prank channels —
per the brief, regardless of popularity.

---

## 4. Coverage gaps

- **Maths for `little` (3–7):** thin. Only `@Numberblocks`, `@KhanAcademyKids`,
  `@numberockllc`, and `@JackHartmann` genuinely fit — most great maths content is `big`.
- **Coding for `little`:** very thin. Effectively only `@codeSparkFOOtubeKids` (and the
  unverified `@Kodable`). Real coding skews `big`.
- **History for `little`:** thin and often unsafe (war/violence). `@HomeschoolPop`,
  `@natgeokids`, and `@freeschool` are the gentle entry points; most history is `big`.
- **Engineering for `little`:** mostly `@HandymanHal`, `@KidsInventStuff`, and the visuals
  of `@JaredOwen`. Hands-on building for the youngest is under-served.
- **Non-English:** not researched here (brief scoped English-first). A future pass could add
  strong non-English science/music channels as a bonus section.
- **Diversity of presenters:** worth a deliberate future pass — many flagship STEM channels
  share a similar host profile.

---

---

## 5. Curated hero videos (individual picks)

A second research pass (9 parallel agents) hand-picked **specific standout videos** from the
vetted channels — the day-one "greatest hits" that complement the pipeline's automatic
channel expansion and seed the extension's offline fallback.

**Verification gate (the important part):** every candidate video ID was checked live against
YouTube's **oEmbed endpoint** (`youtube.com/oembed?url=...`). A real public video returns
HTTP 200 plus its true title and channel author; a fabricated or private ID returns 400/404.
Each ID had to (a) return 200 and (b) have an author matching the expected channel. This makes
hallucinated IDs impossible to sneak into the catalog.

**Result:** 182 candidates → **178 verified videos** across 74 channels (95 tagged `little`,
146 `big`). Output: `docs/data/curated-videos.json` (real titles + thumbnails, keyless).

- **Dropped 4** as genuine wrong-uploader / misattribution: `dBap_Lp-0oc` (actually Veritasium,
  not Steve Mould), a Swick's Classroom re-host, an MIT re-host of a Scratch tutorial, and a
  Begin Learning re-host of a codeSpark video.
- **Handle corrections surfaced by the video check** (also applied to `catalog.yaml`):
  - `@Philharmonia` → **`@philharmonia_orchestra`** (the 6 instrument-guide videos live here)
  - `@NautilusLive` → **`@EVNautilus`** (the deep-sea ROV clips live here)
  - Kept-but-reattributed: 3 Laurie Berkner songs are on official `@LaurieBerknerVEVO`, and
    3 Carnegie Hall videos are on the parent `@carnegiehall` (both authentic).

**Video topic spread:** science 53, music 29, engineering 26, making 25, art 21, space 20,
maths 20, nature 19, animals 16, exploration 14, reading 14, tech 12, history 8, coding 7,
geography 6.

A balanced 36-video subset (17 `little` / 29 `big`, one per channel) is bundled as
`extension/seed-catalog.json` so kids never see an empty page if the live catalog can't load.

---

## Portfolio snapshot

- **~80 channels** in the main feed list; **~23** in `search_only_channels`.
- **`little`-friendly:** ~35 channels tagged `little` — comfortably past the brief's ≥10 floor.
- **Topic spread (main list):** science + space ~30%, art/making ~18%, nature/animals ~13%,
  engineering ~11%, music ~10%, reading ~10%, maths ~9%, coding ~9%, history/geography ~9%
  (channels tagged with multiple topics count in each).
