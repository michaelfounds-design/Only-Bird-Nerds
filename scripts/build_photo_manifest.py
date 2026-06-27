#!/usr/bin/env python3
"""
build_photo_manifest.py
Expand bird-photos/manifest.json from ~700 NA species to ~10,000+ worldwide.

Phase 1 (fast, ~5 min):  paginate iNaturalist bird taxa, match by scientific name.
Phase 2 (thorough, ~2 hr): individual iNat lookup for each unmatched eBird species.

Existing local JPGs (bird-photos/*.jpg) are never overwritten.
Progress is saved every 100 species so the script can be safely interrupted
and rerun — it skips species already in the manifest.

Usage:
    set EBIRD_API_KEY=<your_key>   (or enter when prompted)
    python scripts/build_photo_manifest.py
"""

import os, json, time, csv, io, requests
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO     = Path(__file__).resolve().parent.parent
MANIFEST = REPO / 'bird-photos' / 'manifest.json'

INAT_URL  = 'https://api.inaturalist.org/v1/taxa'
EBIRD_URL = 'https://api.ebird.org/v2/ref/taxonomy/ebird'


# ── Helpers ───────────────────────────────────────────────────────────────────
def load_manifest():
    try:
        with open(MANIFEST, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_manifest(m):
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
    print(f'  Saved manifest ({len(m)} entries)')

def best_photo(taxon):
    """Return the best available photo URL from an iNat taxon dict."""
    photo = taxon.get('default_photo') or {}
    url   = photo.get('medium_url') or photo.get('url') or ''
    url   = url.replace('/square.', '/medium.')
    return url if url.startswith('http') else None


# ── eBird taxonomy ─────────────────────────────────────────────────────────────
def get_ebird_taxonomy(api_key):
    print('Downloading eBird taxonomy...')
    r = requests.get(
        EBIRD_URL,
        params={'fmt': 'csv'},
        headers={'X-eBirdApiToken': api_key},
        timeout=60,
    )
    r.raise_for_status()
    reader = csv.DictReader(io.StringIO(r.text))
    species = {}   # scientific_name -> eBird common name
    for row in reader:
        if row.get('CATEGORY', '').strip().lower() != 'species':
            continue
        sci = row.get('SCI_NAME', '').strip()
        com = (row.get('PRIMARY_COM_NAME') or row.get('COMMON_NAME', '')).strip()
        if sci and com:
            species[sci] = com
    print(f'  {len(species)} species in eBird taxonomy')
    return species


# ── Phase 1: paginate iNat bird taxa ─────────────────────────────────────────
def phase1_paginate(ebird_sci2com, manifest):
    """
    Walk iNaturalist's full Aves species list page by page (~75 requests).
    Match each taxon's scientific name against eBird taxonomy to get the
    authoritative common name.  Falls back to iNat's own common name for
    species not in eBird (international / differently-split taxa).
    """
    print('\nPhase 1 — paginating iNaturalist bird taxa...')
    added = 0
    page  = 1

    while True:
        try:
            r = requests.get(INAT_URL, params={
                'iconic_taxa': 'Aves',
                'rank':        'species',
                'photos':      'true',
                'per_page':    200,
                'page':        page,
            }, timeout=20)
        except requests.RequestException as e:
            print(f'  Network error on page {page}: {e} — retrying in 5s')
            time.sleep(5)
            continue

        if r.status_code != 200:
            print(f'  iNat returned {r.status_code} on page {page} — stopping phase 1')
            break

        data    = r.json()
        results = data.get('results', [])
        if not results:
            break

        for taxon in results:
            sci = taxon.get('name', '').strip()
            # Prefer eBird common name for consistent lookup
            com = ebird_sci2com.get(sci) or taxon.get('preferred_common_name', '').strip()
            if not com or com in manifest:
                continue
            url = best_photo(taxon)
            if url:
                manifest[com] = url
                added += 1

        total = data.get('total_results', '?')
        print(f'  page {page:3d}  results={len(results):3d}  total={total}  added this phase={added}')

        if len(results) < 200:
            break
        page += 1
        time.sleep(0.5)

    return added


# ── Phase 2: individual lookups for unmatched species ────────────────────────
def phase2_individual(ebird_sci2com, manifest):
    """
    For every eBird species still missing a photo after phase 1,
    do a targeted iNat lookup by scientific name.
    Rate-limited to ~80 req/min.
    """
    missing = [(sci, com) for sci, com in ebird_sci2com.items()
               if com not in manifest]
    print(f'\nPhase 2 — individual lookups for {len(missing)} unmatched species...')
    print('  (this takes ~2 hours; safe to stop and rerun — progress is saved every 100)\n')

    added  = 0
    failed = 0

    for i, (sci_name, com_name) in enumerate(missing):
        try:
            r = requests.get(INAT_URL, params={
                'taxon_name': sci_name,
                'rank':       'species',
                'per_page':   1,
                'photos':     'true',
            }, timeout=12)
            if r.status_code == 200:
                results = r.json().get('results', [])
                url = best_photo(results[0]) if results else None
                if url:
                    manifest[com_name] = url
                    added += 1
                else:
                    failed += 1
            else:
                failed += 1
        except requests.RequestException:
            failed += 1

        if (i + 1) % 100 == 0:
            pct = (i + 1) / len(missing) * 100
            print(f'  [{i+1:5d}/{len(missing)}] {pct:5.1f}%  added={added}  no_photo={failed}')
            save_manifest(manifest)

        time.sleep(0.75)   # ~80 req/min, well under the 100/min limit

    return added


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    api_key = os.environ.get('EBIRD_API_KEY') or input('eBird API key: ').strip()

    manifest    = load_manifest()
    local_count = sum(1 for v in manifest.values() if v.startswith('bird-photos/'))
    print(f'Existing manifest: {len(manifest)} entries ({local_count} local photos kept as-is)')

    ebird_sci2com = get_ebird_taxonomy(api_key)

    # Phase 1
    added1 = phase1_paginate(ebird_sci2com, manifest)
    save_manifest(manifest)
    print(f'\nPhase 1 done: +{added1} new species  (total: {len(manifest)})')

    # Phase 2
    added2 = phase2_individual(ebird_sci2com, manifest)
    save_manifest(manifest)
    print(f'\nPhase 2 done: +{added2} new species  (total: {len(manifest)})')

    print(f'\nAll done!')
    print(f'  Local photos preserved : {local_count}')
    print(f'  iNat URLs added        : {added1 + added2}')
    print(f'  Total manifest entries : {len(manifest)}')


if __name__ == '__main__':
    main()
