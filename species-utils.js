// ─────────────────────────────────────────────────────────────
// OnlyBirdNerds — shared species-counting rules
// Loaded by both app.html and shared.html so "how many species" is computed
// identically everywhere. Do NOT duplicate this logic inline in a page's own
// <script> block — that's how this bug (raw-name species counts drifting out
// of sync across pages) has happened more than once already.
// ─────────────────────────────────────────────────────────────

// Not a countable species at all:
//  - slash species, e.g. "Downy/Hairy Woodpecker" (identity ambiguous between 2 species)
//  - spuh, e.g. "gull sp." (identified only to genus/family, not species)
//  - hybrid, e.g. "Mallard x American Black Duck (hybrid)" (not a distinct species)
// Otherwise, a subspecies/group tag collapses into its parent species:
// "Palm Warbler (Western)" -> "Palm Warbler", "Rock Pigeon (Feral Pigeon)" -> "Rock Pigeon"
function baseSpeciesName(name) {
  if (!name) return null;
  if (name.indexOf('/') !== -1 || /\bsp\.$/.test(name) || /\sx\s/.test(name)) return null;
  return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

// Count of distinct countable species across any array of objects with a
// `.name` field (eBird records, trip observations, etc.)
function uniqueSpecies(records) {
  var seen = {};
  (records || []).forEach(function(r) {
    var base = baseSpeciesName(r.name);
    if (base) seen[base] = true;
  });
  return Object.keys(seen).sort();
}
