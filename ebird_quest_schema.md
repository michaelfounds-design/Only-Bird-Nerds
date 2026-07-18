# eBird Quest Badge — Data Schema & Computability Map

## Data Sources Overview

There are three ways to get a user's eBird data, each with different fields and tradeoffs:

| Source | How to access | Freshness | Best for |
|---|---|---|---|
| **Personal CSV export** (`MyEBirdData.csv`) | User downloads from My eBird | Manual, snapshot | MVP / offline evaluation |
| **eBird Public API v2** | REST API with key | Near real-time | Live features, hotspot metadata |
| **eBird Basic Dataset (EBD)** | Bulk request, approved by Cornell | Monthly refresh | Research, global queries |

For onlybirdnerds.com, the practical path is: **user uploads their CSV** (easy, zero API cost) plus **eBird API calls** for things only the API can answer (hotspot checklist counts, rare flags, etc.).

---

## Personal CSV Export — Complete Field List

The `MyEBirdData.csv` file contains one row per **observation** (species × checklist). Fields:

| Column | Type | Example | Notes |
|---|---|---|---|
| `Submission ID` | string | `S30167940` | Unique checklist ID — use to group rows into checklists |
| `Common Name` | string | `Gadwall` | English name; may include subspecies in parens |
| `Scientific Name` | string | `Anas strepera` | Binomial; use for taxonomy lookups |
| `Taxonomic Order` | integer | `377` | eBird/Clements sort order |
| `Count` | string | `3` or `X` | `X` = present but not counted |
| `State/Province` | string | `US-OR` | ISO 3166-2 code |
| `County` | string | `Deschutes` | County name; blank for non-US |
| `Location` | string | `Devil's Lake` | Location name (hotspot or personal) |
| `Latitude` | float | `44.0346655` | Decimal degrees |
| `Longitude` | float | `-121.7622042` | Decimal degrees |
| `Date` | string | `03-30-2016` | MM-DD-YYYY format |
| `Time` | string | `05:00 PM` | 12-hour; blank if not entered |
| `Protocol` | string | `eBird - Stationary Count` | See protocol types below |
| `Duration (Min)` | integer | `60` | Minutes; blank if not entered |
| `All Obs Reported` | boolean | `1` | 1 = complete checklist, 0 = incomplete |
| `Distance Traveled (km)` | float | `1.207` | Traveling counts only; blank for stationary |
| `Area Covered (ha)` | float | — | Area counts only |
| `Number of Observers` | integer | `1` | Party size |
| `Breeding Code` | string | `NY`, `S`, etc. | See eBird breeding code table; blank if none |
| `Species Comments` | string | free text | Observer notes on species |
| `Checklist Comments` | string | free text | Observer notes on checklist |

### Protocol Types (in `Protocol` field)
- `eBird - Traveling Count` → has distance
- `eBird - Stationary Count` → no distance
- `eBird - Area Count` → has area
- `eBird - Incidental Observation` → no effort data (should usually be excluded from quests)
- `eBird - Random Sample Survey` → for atlases
- `Nocturnal Flight Call Count` → night-specific
- `PROALAS` / `TNC Oasis` / other project-specific protocols

### Breeding Codes (in `Breeding Code` field)
Confirmed: `NY`, `NE`, `FS`, `FY`, `CF`, `ON`, `UN`, `DD`
Probable: `P`, `T`, `D`, `A`, `N`, `B`, `PE`, `CN`, `NB`, `M`, `S7`, `M`, `AE`
Possible: `S`, `H`

---

## What You Can Compute from CSV Only

These badges can be evaluated entirely from the user's uploaded CSV — no API calls needed.

### Volume / Endurance

| Badge | Required fields | Computation |
|---|---|---|
| The Centurion (100 spp in one day) | `Submission ID`, `Date`, `Common Name`, `All Obs Reported` | Group by `Submission ID`; count distinct species per date; find any single day ≥ 100 |
| The Chronicler (500 checklists) | `Submission ID` | Count distinct `Submission ID` values |
| The Wandering Eye (1,000 km) | `Distance Traveled (km)` | Sum column (ignore blanks) |

### Time Challenges

| Badge | Required fields | Computation |
|---|---|---|
| The Dawnbreaker (25 checklists before 6 AM) | `Submission ID`, `Time` | Parse time; count distinct submission IDs with time < 06:00 |
| The Twilight Sentinel (checklists at/after sunset) | `Submission ID`, `Time`, `Date`, `Latitude`, `Longitude` | Compute sunset time for lat/lon/date (use astral Python library or a simple lookup table); filter checklists starting within 30 min of or after sunset |
| The Midnight Communion (checklist at midnight+) | `Submission ID`, `Time` | Filter where parsed time is between 00:00 and 03:00 |

### Taxonomic Focus

These require a **species-to-family lookup table** — a static JSON file you maintain mapping `Scientific Name` to family. This is a one-time build using eBird taxonomy CSV (free download at ebird.org/science).

| Badge | Family codes needed |
|---|---|
| The Raptor's Gaze (20+ raptor spp) | Accipitridae, Falconidae, Pandionidae |
| The Warbler Weaver (25+ warblers) | Parulidae |
| The Shore Mystic (30+ shorebirds) | Scolopacidae, Charadriidae |
| The Owl Caller (8+ owls) | Strigidae, Tytonidae |
| The Bog Wraith → needs habitat tag (see API section) | Rallidae |
| The Marsh Phantom (10+ rails) | Rallidae |
| The Bittern Whisperer (5+ bitterns) | Botaurinae (subfamily of Ardeidae) |
| The Silent Witness (12+ wrens) | Troglodytidae |
| The Antbird Hermit (20+ antbirds) | Thamnophilidae |
| The Crane Pilgrim (5+ cranes) | Gruidae |
| The Wingspan Sovereign (25+ large-wingspan spp) | Custom species list — build a curated list of qualifying species with avg wingspan > 150cm |

### Seasonality

| Badge | Required fields | Computation |
|---|---|---|
| Migration Rider (75+ spp Apr–May, one year) | `Date`, `Common Name` | Filter date to Apr 1–May 31; count distinct species per year |
| Winter Holdout (40+ spp Dec–Jan, one year) | `Date`, `Common Name` | Filter date to Dec 1–Jan 31; count distinct species per year |
| Breeding Witness (10+ species with confirmed codes) | `Breeding Code`, `Common Name` | Filter to confirmed codes (NY, NE, FS, FY, CF, ON, UN, DD); count distinct species |

### Skulk & Seek

| Badge | Required fields | Computation |
|---|---|---|
| The Thicket Oracle (heard-only species) | `Count`, `Common Name` | Filter rows where `Count` = `0` — eBird encodes heard-only as count=0 in the export. Count distinct species. |
| The King's Ransom (all NA rail species) | `Common Name`, family lookup | Check for presence of: Virginia Rail, Sora, King Rail, Clapper Rail, Black Rail, Yellow Rail, Purple Gallinule, Common Gallinule |

> **Heard-only caveat**: eBird's personal export encodes heard-only as count=0 or "X" with a species comment. This is imperfect — need to verify behavior in practice. May need to cross-reference `Species Comments` for the word "heard."

### Spatial Coverage

| Badge | Required fields | Computation |
|---|---|---|
| County Cartographer (100 spp per county, one state) | `State/Province`, `County`, `Common Name` | Group by state+county; count distinct species; find counties with ≥ 100 spp; calculate % of state's total counties covered |
| State Cartographer (% of counties visited) | `State/Province`, `County` | Count distinct counties per state / total counties in state (need a static county count lookup table per state) |
| Forgotten Corner Finder (county with <10 total checklists ever) | `County`, `State/Province` | **Requires API** — see below |

---

## What Requires the eBird API

These badges need live lookups that the CSV can't provide alone.

### eBird API v2 Key Endpoints

Base URL: `https://api.ebird.org/v2/`  
Header: `X-eBirdApiToken: YOUR_KEY`

| Endpoint | What it returns | Used for |
|---|---|---|
| `GET /ref/hotspot/info/{locId}` | Hotspot metadata: name, lat/lon, total checklists, latest obs date, species count | Hotspot Pioneer, Lantern Bearer, Atlas Builder |
| `GET /product/lists/{regionCode}` | Recent checklists in a region | Patch Warden verification |
| `GET /ref/region/list/{regionType}/{regionCode}` | List of subregions (e.g. all counties in Oregon) | State county count lookup |
| `GET /data/obs/{regionCode}/recent/notable` | Recent rare/notable sightings | The Anomaly badge |
| `GET /ref/hotspot/geo` | Hotspots near a lat/lon | Hotspot discovery workflows |
| `GET /ref/taxonomy/ebird` | Full taxonomy with family codes | Build your family lookup table |

### Badges Requiring API Calls

| Badge | API call needed | Logic |
|---|---|---|
| **The Anomaly** (self-found rare) | `GET /data/obs/{regionCode}/recent/notable` | Cross-reference user's species+location+date against eBird rare flags for that region |
| **The Forgotten Corner Finder** | `GET /ref/hotspot/info/{locId}` | Extract location IDs from user CSV; call hotspot info endpoint; check `numChecklistsAllTime` field |
| **The Lantern Bearer** (10 checklists to low-activity hotspots) | `GET /ref/hotspot/info/{locId}` | For each hotspot in user CSV, get total checklists; flag hotspots where total was < 5 at user's first visit date |
| **The Seedling** (first 3 contributors to an eventually popular hotspot) | `GET /ref/hotspot/info/{locId}` + checklist history | Hard — requires knowing checklist submission order; approximate by checking if user's first checklist date at a hotspot is very early AND hotspot now has 100+ checklists |
| **Hotspot Pioneer** (first ever checklist at a hotspot) | `GET /ref/hotspot/info/{locId}` | Check if `numChecklistsAllTime` == 1 at time of user's visit — not directly queryable; approximate by first-visit date being close to hotspot creation date |
| **The Neighborhood Naturalist** (25+ checklists at personal location) | CSV only, but need to flag non-hotspot locations | Check if `Location` does not appear in eBird hotspot database — requires API to verify |
| **County Sovereign (Legendary tier)** | `GET /ref/region/list/subnational2/{stateCode}` | Get total county count for state to verify 100% completion |

---

## Static Lookup Tables You Need to Build

These are one-time files you create and store in your app, not live API calls:

### 1. eBird Taxonomy Table
Download from: `https://www.birds.cornell.edu/clementschecklist/download/`

Fields to keep: `species_code`, `primary_com_name`, `sci_name`, `family_com_name`, `family_sci_name`, `order`

Use for: all taxonomic badges (family-level filtering)

### 2. Large Wingspan Species List
Curated list of species with avg wingspan > 150cm. Suggested inclusions:
- All Cathartidae (New World vultures, incl. California Condor)
- All Diomedeidae (albatrosses)
- All Gruidae (cranes)
- Pelecanus spp.
- Cygnus spp. (swans)
- Aquila, Haliaeetus, Buteo (largest eagles/hawks)
- Ardea herodias, Ardea alba (large herons)

### 3. County Count by State
Static JSON: `{ "US-OR": 36, "US-WA": 39, "US-CA": 58, ... }`
Source: US Census FIPS data

### 4. Skulky Species Master List
For Skulk & Seek badges, a curated list of notoriously skulky species beyond just family-level:
Rails, bitterns, marsh wrens, sedge wrens, Virginia's Warbler, Connecticut Warbler, Veery, Sora, etc.

---

## Recommended Architecture for Badge Evaluation

```
User uploads MyEBirdData.csv
        ↓
Parse CSV → normalize dates, times, parse lat/lon
        ↓
Run CSV-only badge checks (fast, no API)
        ↓
Extract unique location IDs from CSV
        ↓
Batch API calls for hotspot metadata (rate-limit aware)
        ↓
Run API-dependent badge checks
        ↓
Cross-reference with static lookup tables
        ↓
Return badge results with tier (Bronze/Silver/Gold/Legendary)
```

### Rate Limiting Notes
- eBird API: no published hard limit, but Cornell asks for reasonable use
- Cache all hotspot metadata responses — a given `locId` result rarely changes
- Batch location lookups: don't query one at a time, group into batches of 10-20

---

## Badge Computability Summary

| Badge | CSV only | CSV + static table | CSV + API | Difficulty |
|---|---|---|---|---|
| The Centurion | ✓ | | | Easy |
| The Chronicler | ✓ | | | Easy |
| The Wandering Eye | ✓ | | | Easy |
| The Dawnbreaker | ✓ | | | Easy |
| The Twilight Sentinel | ✓ | | | Medium (sunset calc) |
| The Midnight Communion | ✓ | | | Easy |
| Migration Rider | ✓ | | | Easy |
| Winter Holdout | ✓ | | | Easy |
| Breeding Witness | ✓ | | | Easy |
| The Raptor's Gaze | | ✓ | | Easy |
| The Warbler Weaver | | ✓ | | Easy |
| The Shore Mystic | | ✓ | | Easy |
| The Owl Caller | | ✓ | | Easy |
| The Marsh Phantom | | ✓ | | Easy |
| The Bittern Whisperer | | ✓ | | Easy |
| The Silent Witness | | ✓ | | Easy |
| The Wingspan Sovereign | | ✓ | | Medium (build species list) |
| The Thicket Oracle (heard-only) | ✓ | | | Medium (encoding quirk) |
| County Cartographer | ✓ | ✓ | | Medium |
| State Cartographer | | ✓ | | Medium |
| The Anomaly (rare bird) | | | ✓ | Hard |
| The Forgotten Corner Finder | | | ✓ | Medium |
| The Lantern Bearer | | | ✓ | Hard |
| The Seedling | | | ✓ | Hard |
| Hotspot Pioneer | | | ✓ | Hard |
| The Neighborhood Naturalist | | | ✓ | Medium |
| County Sovereign (Legendary) | | ✓ | ✓ | Hard |

---

## MVP Recommendation

Start with all **CSV-only** and **CSV + static table** badges. That's ~20 badges with zero API dependency — enough for a compelling launch. Add API-dependent badges in a second phase once you have an eBird API key and rate-limit handling in place.
