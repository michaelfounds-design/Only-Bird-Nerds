"""
Fetches eBird community hotspots for the Pacific Northwest and saves as GeoJSON.
Run once, then commit data/pnw_hotspots.geojson to update the site.

Usage:
    python build_ebird_hotspots.py

Requires: Your eBird API key set below (get one at https://ebird.org/api/keygen)
"""

import json
import os
import ssl
import time
import urllib.request

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

EBIRD_API_KEY = os.environ.get('EBIRD_API_KEY', '')  # set via env var

# Grid of center points (lat, lon, label) covering OR + WA + northern CA coast
# Each query fetches hotspots within 200 km, results are deduplicated by locId.
QUERY_POINTS = [
    (44.0, -120.5, 'Oregon central'),
    (45.5, -122.5, 'Oregon northwest / Portland'),
    (42.5, -118.8, 'Oregon southeast / Malheur'),
    (42.0, -121.8, 'Oregon south / Klamath'),
    (44.0, -124.0, 'Oregon coast'),
    (46.5, -120.5, 'Washington central'),
    (47.5, -122.3, 'Washington northwest / Seattle'),
    (48.5, -122.3, 'Washington north'),
    (46.9, -119.4, 'Washington southeast / Columbia Basin'),
    (46.2, -123.8, 'Washington southwest'),
]

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'pnw_hotspots.geojson')


def fetch_hotspots(lat, lon, dist_km=200):
    url = (
        'https://api.ebird.org/v2/ref/hotspot/geo'
        '?lat=' + str(lat) + '&lng=' + str(lon) + '&dist=' + str(dist_km) + '&fmt=json'
    )
    req = urllib.request.Request(url, headers={'X-eBirdApiToken': EBIRD_API_KEY})
    with urllib.request.urlopen(req, timeout=20, context=_SSL_CTX) as r:
        return json.loads(r.read())


def main():
    if not EBIRD_API_KEY:
        print('Error: set EBIRD_API_KEY inside the script before running.')
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    seen = set()
    features = []

    for lat, lon, label in QUERY_POINTS:
        print(f'Fetching hotspots near {label}...')
        try:
            spots = fetch_hotspots(lat, lon)
            added = 0
            for s in spots:
                lid = s.get('locId')
                if not lid or lid in seen:
                    continue
                seen.add(lid)
                added += 1
                features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [s['lng'], s['lat']]},
                    'properties': {
                        'locId':              lid,
                        'locName':            s.get('locName', ''),
                        'numSpeciesAllTime':  s.get('numSpeciesAllTime', 0),
                    }
                })
            print(f'  {added} new (total so far: {len(features)})')
        except Exception as e:
            print(f'  error: {e}')
        time.sleep(0.5)

    # Keep only well-documented hotspots (200+ species keeps file small and meaningful)
    MIN_SPECIES = 200
    features = [f for f in features if f['properties']['numSpeciesAllTime'] >= MIN_SPECIES]
    features.sort(key=lambda x: -x['properties']['numSpeciesAllTime'])

    gj = {'type': 'FeatureCollection', 'features': features}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(gj, f, separators=(',', ':'))

    import os as _os
    kb = _os.path.getsize(OUT) / 1024
    print(f'\nSaved {len(features)} hotspots ({MIN_SPECIES}+ species, {kb:.0f} KB) to {OUT}')
    print('Now commit data/pnw_hotspots.geojson and push to update the site.')


if __name__ == '__main__':
    main()
