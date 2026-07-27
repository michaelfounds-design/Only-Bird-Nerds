"""
Download WDPA protected areas from Protected Planet API → data/wdpa.geojson
Run once (takes several minutes for USA). Re-run to refresh.

Usage:
    python download_wdpa.py
    python download_wdpa.py USA CAN MEX
"""

import requests, json, time, sys, os

KEY      = '1275c3692380e3dc95d412d7481b5ad3'
BASE     = 'https://api.protectedplanet.net/v3/protected_areas'
PER_PAGE = 50
MIN_HA   = 50        # skip tiny areas (< 50 ha) to keep file size down
COORD_DP = 4         # decimal places (~11 m precision, plenty for map display)
OUT      = os.path.join(os.path.dirname(__file__), 'data', 'wdpa.geojson')

COUNTRIES = sys.argv[1:] or ['USA', 'CAN', 'MEX']


def _round_coords(coords):
    """Recursively round coordinate values to COORD_DP decimal places."""
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], COORD_DP), round(coords[1], COORD_DP)]
    return [_round_coords(c) for c in coords]


def simplify_geom(geom):
    if not geom or not geom.get('type'):
        return None
    try:
        g = dict(geom)
        g['coordinates'] = _round_coords(g['coordinates'])
        return g
    except Exception:
        return None


def fetch_page(country, page):
    url = (f'{BASE}?token={KEY}&country={country}'
           f'&with_geometry=true&per_page={PER_PAGE}&page={page}')
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


features = []

for country in COUNTRIES:
    print(f'\n── {country} ─────────────────')
    page, skipped = 1, 0
    while True:
        try:
            data = fetch_page(country, page)
        except Exception as e:
            print(f'  Page {page} error: {e}')
            break

        areas = data.get('protected_areas', [])
        if not areas:
            print(f'  No more results at page {page}.')
            break

        for pa in areas:
            # Skip tiny areas
            area_ha = pa.get('reported_area') or 0
            if area_ha < MIN_HA:
                skipped += 1
                continue

            raw_geom = pa.get('geojson')
            # API may return geometry as a JSON string
            if isinstance(raw_geom, str):
                try:
                    raw_geom = json.loads(raw_geom)
                except Exception:
                    raw_geom = None

            geom = simplify_geom(raw_geom)
            if not geom:
                skipped += 1
                continue

            iucn  = (pa.get('iucn_category') or {}).get('name', '')
            desig = (pa.get('designation')   or {}).get('name', '')
            wdpa_id = pa.get('wdpa_id') or ''

            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': {
                    'name':    pa.get('name', 'Protected Area'),
                    'wdpa_id': str(wdpa_id),
                    'iucn':    iucn,
                    'desig':   desig,
                    'area_ha': round(area_ha),
                }
            })

        print(f'  Page {page:3d}: +{len(areas)} areas  |  total {len(features)}  skipped {skipped}')

        if len(areas) < PER_PAGE:
            break
        page += 1
        time.sleep(0.35)   # ~3 req/s — be polite to the API


os.makedirs(os.path.dirname(OUT), exist_ok=True)
gj = {'type': 'FeatureCollection', 'features': features}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(gj, f, separators=(',', ':'))

size_mb = os.path.getsize(OUT) / 1_048_576
print(f'\n✓  {len(features)} features → {OUT}  ({size_mb:.1f} MB)')
print('Now run: git add data/wdpa.geojson && git commit -m "Add WDPA data"')
