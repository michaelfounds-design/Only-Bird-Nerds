# eBird Quest Badge System — v2 Expansion Spec

**Companion to:** `ebird_quest_schema.md` (data schema & computability map)
**Purpose:** Convert single-threshold badges into tiered ladders, add on-ramp / quirk / taxonomic badges, and introduce regional packs (PNW pack included as pilot). All computations use the same three data sources defined in the base schema: personal CSV, static lookup tables, eBird API.

**Implementation priority:**
1. Tier ladder conversion (highest leverage, zero new logic)
2. On-ramp badges
3. Quirk badges
4. New taxonomic badges
5. Regional pack engine + PNW pack
6. Monthly rotating quests (phase 2)

---

## 1. Tier Ladder System

Every badge becomes a four-rung ladder: **Bronze → Silver → Gold → Legendary**. The computation is identical to the base schema; only the threshold changes per tier. UI should show a progress bar toward the next unearned tier.

### 1.1 Ladder conversion for existing badges

| Badge | Metric | Bronze | Silver | Gold | Legendary |
|---|---|---|---|---|---|
| The Centurion | Max distinct species in one calendar day | 50 | 75 | 100 | 150 |
| The Chronicler | Total distinct checklists | 25 | 100 | 500 | 2,000 |
| The Wandering Eye | Cumulative `Distance Traveled (km)` | 100 | 500 | 1,000 | 5,000 |
| The Dawnbreaker | Checklists starting before 06:00 | 5 | 10 | 25 | 100 |
| The Twilight Sentinel | Checklists within 30 min of / after sunset | 5 | 15 | 40 | 100 |
| The Midnight Communion | Checklists 00:00–03:00 | 1 | 5 | 15 | 50 |
| Migration Rider | Distinct spp, Apr 1–May 31, single year | 40 | 60 | 75 | 125 |
| Winter Holdout | Distinct spp, Dec 1–Jan 31, single winter | 20 | 30 | 40 | 75 |
| Breeding Witness | Distinct spp with confirmed breeding codes | 3 | 6 | 10 | 25 |
| The Raptor's Gaze | Distinct raptor spp (Accipitridae, Falconidae, Pandionidae) | 8 | 14 | 20 | 30 |
| The Warbler Weaver | Distinct Parulidae spp | 10 | 18 | 25 | 35 |
| The Shore Mystic | Distinct shorebird spp (Scolopacidae, Charadriidae) | 12 | 20 | 30 | 40 |
| The Owl Caller | Distinct owl spp (Strigidae, Tytonidae) | 3 | 5 | 8 | 12 |
| The Marsh Phantom | Distinct Rallidae spp | 3 | 5 | 8 | 12 |
| The Silent Witness | Distinct Troglodytidae (wren) spp | 4 | 7 | 10 | 15 |
| The Thicket Oracle | Distinct heard-only spp (see caveats §7) | 10 | 25 | 50 | 100 |
| County Cartographer | Counties with ≥ 100 spp | 1 | 3 | 10 | 25 |
| State Cartographer | % of home state's counties with ≥ 1 checklist | 25% | 50% | 75% | 100% |
| The Wingspan Sovereign | Distinct spp from large-wingspan list | 8 | 15 | 25 | 35 |

**Winter season note:** "single winter" for Winter Holdout means Dec of year N + Jan of year N+1 (a winter spans the year boundary). Group by winter-season key, not calendar year.

### 1.2 Location-loyalty ladder (merged badge line)

Merge The Patchling / Neighborhood Naturalist / Patch Warden into one ladder keyed on max checklists at a single location:

| Tier | Name | Threshold |
|---|---|---|
| Bronze | The Patchling | 10 checklists at one location |
| Silver | The Neighborhood Naturalist | 25 |
| Gold | The Patch Warden | 100 |
| Legendary | The Rooted | 365 |

CSV-only for personal locations; the "is this a hotspot vs. personal location" distinction from the base schema is no longer required for this ladder (any single location qualifies). This removes an API dependency.

---

## 2. On-Ramp Badges (CSV-only, all Easy)

Goal: every user earns something on upload day. These are single-award (no tiers) unless noted.

| Badge | Trigger | Computation |
|---|---|---|
| **The Fledgling** | First checklist ever | `count(distinct Submission ID) >= 1`. Award with the date of the user's first checklist displayed ("Fledged March 30, 2016"). |
| **The Completionist** | ≥ 90% of checklists marked complete | `sum(All Obs Reported == 1) / count(checklists) >= 0.90`, minimum 20 checklists. Rewards eBird hygiene, not volume. |
| **The Scribe** | Species comments on observations | Tiered: 10 / 50 / 200 / 1,000 rows with non-blank `Species Comments`. |
| **The Enumerator** | Checklists with zero "X" counts | Tiered: 25 / 100 / 500 / 2,000 checklists where every `Count` is numeric. Rewards people who actually count. |

---

## 3. Quirk Badges (CSV-only unless noted)

| Badge | Trigger | Computation | Difficulty |
|---|---|---|---|
| **The Big Sit** | Stationary count ≥ 180 min | `Protocol == 'eBird - Stationary Count'` AND `Duration (Min) >= 180`. Tiers: 180 / 300 / 480 / 720 min (single checklist). | Easy |
| **The Death March** | Single traveling count > 15 km | Max single-checklist `Distance Traveled (km)`. Tiers: 8 / 15 / 25 / 40 km. | Easy |
| **The Phenologist** | Same location birded across calendar months | Per location, count distinct months (1–12) with ≥ 1 checklist, across all years. Tiers: 8 / 10 / 12 months / 12 months at 3+ locations. | Easy |
| **New Year's Devotee** | Jan 1 checklists in consecutive years | Longest streak of consecutive years with a Jan 1 checklist. Tiers: 2 / 3 / 5 / 10 years. | Easy |
| **The Leap Lister** | Any checklist on Feb 29 | Single award. Date parse: month == 02, day == 29. | Easy |
| **The Loyalist** | One species on many of your checklists | Max over species of `count(distinct Submission ID containing species)`. Tiers: 50 / 100 / 200 / 500. Display the species: "Your bird is Song Sparrow." | Easy |
| **The Pilgrim** | Distinct states/provinces | `count(distinct State/Province)`. Tiers: 2 / 5 / 10 / 25. | Easy |
| **The Continental** | Distinct countries | Parse country prefix from `State/Province` ISO code (chars before first hyphen; e.g. `US-OR` → `US`, `MX-ROO` → `MX`). Tiers: 2 / 3 / 5 / 8. | Easy |

---

## 4. New Taxonomic Badges

All use the static taxonomy lookup table from the base schema (§ Static Lookup Tables), except where noted.

| Badge | Group | Filter | Bronze | Silver | Gold | Legendary |
|---|---|---|---|---|---|---|
| **The Larophile's Burden** | Gulls | Common-name match: contains "Gull" or "Kittiwake" (see note) | 6 | 10 | 15 | 22 |
| **The Little Brown Sage** | New World sparrows | Family Passerellidae | 8 | 14 | 20 | 30 |
| **The Drummer's Circle** | Woodpeckers | Family Picidae | 5 | 8 | 12 | 18 |
| **The Nectar Baron** | Hummingbirds | Family Trochilidae | 2 | 4 | 8 | 15 |
| **The Corvid Cabal** | Corvids | Family Corvidae, scored against user's home-state regional list (see §5.2) | 50% of list | 75% | 100% | 100% + Clark's Nutcracker or Canada Jay heard-only |

**Gull filter note:** Do NOT filter on family Laridae — in eBird taxonomy that family also includes terns and skimmers. Common-name string matching ("Gull", "Kittiwake") is more robust here, but exclude hybrid and "sp." rows (any `Common Name` containing "hybrid", "sp.", or a slash "/") to avoid counting "Herring x Glaucous-winged Gull (hybrid)" and "gull sp." as species.

**Nectar Baron fairness note:** thresholds are deliberately low at Bronze/Silver because hummingbird diversity is intensely regional. 2 species is a real accomplishment in Oregon; 8+ effectively requires the Southwest. That regional stretch is the point — it's a travel incentive, not a home-patch badge.

---

## 5. Regional Pack Engine

### 5.1 Architecture

Regional packs are static JSON files following the same pattern as the wingspan table: curated species lists + match rules, no API required. One file per pack.

**Pack JSON format:**

```json
{
  "pack_id": "string",
  "pack_name": "string",
  "region_codes": ["US-OR", "US-WA"],
  "badges": [
    {
      "badge_id": "string",
      "name": "string",
      "description": "string (flavor text shown to user)",
      "match_type": "species_list | species_count | location_match",
      "species": ["Common Name", "..."],
      "location_rules": { "county": "...", "state": "...", "name_contains": "..." },
      "tiers": { "bronze": 0, "silver": 0, "gold": 0, "legendary": 0 },
      "tier_unit": "species_from_list | checklists | visits"
    }
  ]
}
```

**Match types:**
- `species_list` — count distinct species from `species[]` present anywhere in user CSV. Match on `Common Name` (exact, after stripping subspecies parentheticals — e.g. "Song Sparrow (rufina Group)" → "Song Sparrow").
- `species_count` — count checklists containing a single target species.
- `location_match` — count checklists where location fields match `location_rules` (case-insensitive substring on `Location`, exact on `County` + `State/Province`).

### 5.2 Home-region detection

Auto-detect the user's home region so the right pack (and Corvid Cabal list) surfaces first:

```
home_state = modal State/Province across all checklists
home_county = modal County within home_state
```

Show the matching regional pack at the top of the badge page; other packs remain visible but collapsed ("Traveling? Explore other packs").

### 5.3 Corvid Cabal regional lists (static JSON)

```json
{
  "US-OR": ["Steller's Jay", "California Scrub-Jay", "Canada Jay", "Pinyon Jay",
            "Clark's Nutcracker", "Black-billed Magpie", "American Crow", "Common Raven"],
  "US-WA": ["Steller's Jay", "California Scrub-Jay", "Canada Jay",
            "Clark's Nutcracker", "Black-billed Magpie", "American Crow", "Common Raven"]
}
```

Extend per state as packs are added. (Note: Northwestern Crow was lumped into American Crow in 2020, so it does not appear separately in current taxonomy exports.)

---

## 6. PNW Regional Pack (pilot) — `packs/pnw.json`

```json
{
  "pack_id": "pnw",
  "pack_name": "Pacific Northwest",
  "region_codes": ["US-OR", "US-WA", "US-ID", "CA-BC"],
  "badges": [
    {
      "badge_id": "dippers_creed",
      "name": "The Dipper's Creed",
      "description": "The patron bird of cold, clean, fast water. Kneel at the riffle and count your blessings.",
      "match_type": "species_count",
      "species": ["American Dipper"],
      "tiers": { "bronze": 3, "silver": 10, "gold": 25, "legendary": 75 },
      "tier_unit": "checklists"
    },
    {
      "badge_id": "salmonberry_circuit",
      "name": "The Salmonberry Circuit",
      "description": "The wet-side gauntlet. Fog, moss, and birds that would rather you didn't see them.",
      "match_type": "species_list",
      "species": [
        "Varied Thrush",
        "Sooty Grouse",
        "Harlequin Duck",
        "Black Oystercatcher",
        "Pacific Wren",
        "Marbled Murrelet",
        "Chestnut-backed Chickadee",
        "Red-breasted Sapsucker",
        "Band-tailed Pigeon",
        "Northern Pygmy-Owl",
        "Hermit Warbler",
        "American Dipper"
      ],
      "tiers": { "bronze": 4, "silver": 7, "gold": 10, "legendary": 12 },
      "tier_unit": "species_from_list"
    },
    {
      "badge_id": "sagebrush_sea",
      "name": "The Sagebrush Sea",
      "description": "Cross the mountains. Trade the ferns for silence, distance, and the smell of rain on sage.",
      "match_type": "species_list",
      "species": [
        "Greater Sage-Grouse",
        "Sage Thrasher",
        "Sagebrush Sparrow",
        "Brewer's Sparrow",
        "Burrowing Owl",
        "Ferruginous Hawk",
        "Long-billed Curlew",
        "Loggerhead Shrike",
        "Prairie Falcon",
        "Rock Wren"
      ],
      "tiers": { "bronze": 3, "silver": 5, "gold": 8, "legendary": 10 },
      "tier_unit": "species_from_list"
    },
    {
      "badge_id": "alcid_ascetic",
      "name": "The Alcid Ascetic",
      "description": "Stand on the headland. Squint at the swells. The sea gives up its monks reluctantly.",
      "match_type": "species_list",
      "species": [
        "Common Murre",
        "Pigeon Guillemot",
        "Marbled Murrelet",
        "Ancient Murrelet",
        "Cassin's Auklet",
        "Rhinoceros Auklet",
        "Tufted Puffin"
      ],
      "tiers": { "bronze": 2, "silver": 4, "gold": 6, "legendary": 7 },
      "tier_unit": "species_from_list"
    },
    {
      "badge_id": "malheur_pilgrimage",
      "name": "The Malheur Pilgrimage",
      "description": "Every PNW birder owes the high desert a spring. Pay your debt at the refuge.",
      "match_type": "location_match",
      "location_rules": { "state": "US-OR", "county": "Harney", "name_contains": "Malheur" },
      "tiers": { "bronze": 1, "silver": 5, "gold": 15, "legendary": 50 },
      "tier_unit": "checklists"
    },
    {
      "badge_id": "estuary_keeper",
      "name": "The Estuary Keeper",
      "description": "Where the river forgets it was ever in a hurry. Mudflats, tide charts, and ten thousand wings.",
      "match_type": "species_list",
      "species": [
        "Black-bellied Plover",
        "Dunlin",
        "Western Sandpiper",
        "Marbled Godwit",
        "Whimbrel",
        "Greater Yellowlegs",
        "Caspian Tern",
        "Brant"
      ],
      "tiers": { "bronze": 3, "silver": 5, "gold": 7, "legendary": 8 },
      "tier_unit": "species_from_list"
    }
  ]
}
```

**Site-pilgrimage generalization:** `malheur_pilgrimage` is the template for future pack sites — Magee Marsh (Midwest pack), Cape May (Northeast), High Island (Texas), Ridgefield NWR (a second PNW site if desired). Same `location_match` logic every time.

---

## 7. Data Caveats (add to base schema)

1. **Blank `Time` fields.** A large fraction of real checklists have no time recorded. All time-based badges (Dawnbreaker, Twilight Sentinel, Midnight Communion) silently undercount. UI requirement: display "N checklists excluded (no time recorded)" beneath each time-based badge.
2. **Heard-only encoding is unreliable.** Ship The Thicket Oracle flagged as *experimental* in the UI, with tooltip explaining the count=0 heuristic. Optionally cross-reference `Species Comments` for "heard" (case-insensitive) as a secondary signal.
3. **Subspecies and spuhs.** Before any distinct-species count, normalize `Common Name`: strip parenthetical subspecies qualifiers, and exclude rows containing "sp.", "/", "hybrid", or "Domestic type". This affects every badge; implement once in the CSV normalization step.
4. **Date parsing.** Base schema shows `MM-DD-YYYY`, but eBird has changed export date formats over the years. Parse defensively (try `MM-DD-YYYY`, then `YYYY-MM-DD`) and log unparseable rows.
5. **Winter season boundary.** See §1.1 — Winter Holdout must group Dec+Jan across the year boundary.

---

## 8. Monthly Rotating Quests (Phase 2 spec, brief)

Static JSON calendar of 12 recurring monthly quests, evaluated against the user's CSV rows falling within the current month/year on re-upload (or via API in a later phase). Purpose: give lapsed users a reason to return.

```json
{
  "01": { "name": "The Resolution", "goal": "10 checklists in January" },
  "02": { "name": "Gull Month", "goal": "Add 3 gull species this month" },
  "03": { "name": "The Early Bird", "goal": "5 checklists before 7 AM" },
  "04": { "name": "Wave Rider", "goal": "20 species of arriving migrants" },
  "05": { "name": "The Dawn Chorus", "goal": "One checklist ≥ 60 min before 8 AM" },
  "06": { "name": "Breeding Season Scribe", "goal": "Record 5 breeding codes" },
  "07": { "name": "The Doldrums Devotee", "goal": "8 checklists in the slowest month" },
  "08": { "name": "Shorebird South", "goal": "8 shorebird species" },
  "09": { "name": "The Exodus", "goal": "15 checklists during fall push" },
  "10": { "name": "Sparrow Spree", "goal": "8 sparrow species" },
  "11": { "name": "The Rarity Window", "goal": "One checklist at a new location" },
  "12": { "name": "Count Season", "goal": "One checklist ≥ 3 hours (CBC spirit)" }
}
```

Monthly quest completions accrue to a meta-badge: **The Calendar Keeper** (Bronze 3 / Silver 6 / Gold 12 / Legendary 24 monthly quests completed lifetime).

---

## 9. Updated Computability Summary (new badges only)

| Badge | CSV only | CSV + static table | CSV + API | Difficulty |
|---|---|---|---|---|
| The Fledgling | ✓ | | | Easy |
| The Completionist | ✓ | | | Easy |
| The Scribe | ✓ | | | Easy |
| The Enumerator | ✓ | | | Easy |
| The Big Sit | ✓ | | | Easy |
| The Death March | ✓ | | | Easy |
| The Phenologist | ✓ | | | Easy |
| New Year's Devotee | ✓ | | | Easy |
| The Leap Lister | ✓ | | | Easy |
| The Loyalist | ✓ | | | Easy |
| The Pilgrim | ✓ | | | Easy |
| The Continental | ✓ | | | Easy |
| Location-loyalty ladder (Patchling→Rooted) | ✓ | | | Easy |
| The Larophile's Burden | ✓ | | | Easy (name matching) |
| The Little Brown Sage | | ✓ | | Easy |
| The Drummer's Circle | | ✓ | | Easy |
| The Nectar Baron | | ✓ | | Easy |
| The Corvid Cabal | | ✓ | | Medium (regional lists) |
| PNW pack (all 6 badges) | | ✓ | | Easy–Medium |
| Monthly quests | ✓ | ✓ | | Medium (phase 2) |

Everything in this expansion ships with **zero API dependency**, consistent with the base schema's MVP recommendation.

---

## 10. Implementation Notes for Claude Code

1. **Normalization first.** Build one `normalize_csv()` step (dates, times, common-name cleanup per §7.3) that every badge evaluator consumes. Do not let individual badges re-parse raw fields.
2. **Badge evaluators are pure functions.** `evaluate(normalized_rows, config) → { tier, value, next_threshold }`. Config-driven thresholds so tier tuning never touches logic.
3. **Regional packs load dynamically** from `packs/*.json`; the evaluator dispatches on `match_type`. Adding a new region should require zero code changes.
4. **Every tiered badge returns progress** toward the next tier for the UI progress bar, even at zero.
5. **Tier thresholds are provisional.** Tune against real CSVs (start with the founder's own export) before launch — the right feel is: a 2-year birder earns 8–12 Bronzes on first upload.
