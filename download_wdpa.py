"""
Download WDPA protected areas from the public ArcGIS FeatureServer
(no API key needed; same authoritative data as Protected Planet).

Run once, then commit data/wdpa.geojson.
Usage:
    python download_wdpa.py              # USA, CAN, MEX
    python download_wdpa.py USA CAN      # specific countries
"""

import requests, json, time, sys, os

# WDPA public ArcGIS FeatureServer (no auth required)
# Field names are lowercase: iso3, rep_area, status, name, iucn_cat, desig_eng
BASE_POLY  = ('https://services5.arcgis.com/Mj0hjvkNtV7NRhA7/arcgis/rest'
              '/services/WDPA_v0/FeatureServer/1/query')   # polygons
BASE_POINT = ('https://services5.arcgis.com/Mj0hjvkNtV7NRhA7/arcgis/rest'
              '/services/WDPA_v0/FeatureServer/0/query')   # points (small areas)

COUNTRIES = sys.argv[1:] or ['USA', 'CAN', 'MEX']
BATCH     = 500    # max records per request
MIN_HA    = 2000   # skip areas < 2000 ha (~20 km²) — keeps major parks/refuges
COORD_DP  = 2      # coordinate decimal places (~1 km precision, fine for conservation layer)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'wdpa.geojson')

# Field names are lowercase in this service
FIELDS = 'name,iucn_cat,desig_eng,rep_area,iso3,status'


def _get(d, *keys):
    """Try each key variant (handles ArcGIS returning alias or field name)."""
    for k in keys:
        if k in d:
            return d[k]
    return None


def fetch_layer(base_url, country):
    features, offset = [], 0
    # Field names must be lowercase in WHERE clause
    where = f"iso3='{country}' AND rep_area>={MIN_HA} AND status='Designated'"
    while True:
        params = {
            'where':             where,
            'outFields':         FIELDS,
            'returnGeometry':    'true',
            'geometryPrecision': COORD_DP,
            'f':                 'geojson',
            'resultOffset':      offset,
            'resultRecordCount': BATCH,
        }
        try:
            r = requests.get(base_url, params=params, timeout=60)
            r.raise_for_status()
            gj = r.json()
        except Exception as e:
            print(f'    error at offset {offset}: {e}')
            break

        if 'error' in gj:
            print(f'    API error: {gj["error"]}')
            break

        batch = gj.get('features', [])
        if not batch:
            break

        for f in batch:
            geom = f.get('geometry')
            if not geom:
                continue
            props = f.get('properties') or {}
            # ArcGIS GeoJSON may return alias (upper) or field name (lower)
            name    = _get(props, 'name', 'NAME') or ''
            iucn    = _get(props, 'iucn_cat', 'IUCN_CAT') or ''
            desig   = _get(props, 'desig_eng', 'DESIG_ENG') or ''
            area_ha = round(float(_get(props, 'rep_area', 'REP_AREA') or 0))
            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': {
                    'name':    name,
                    'iucn':    iucn,
                    'desig':   desig,
                    'area_ha': area_ha,
                }
            })

        print(f'    offset {offset:5d}  batch {len(batch):4d}  total {len(features)}')
        if len(batch) < BATCH:
            break
        offset += BATCH
        time.sleep(0.3)

    return features


all_features = []

for country in COUNTRIES:
    print(f'\n── {country} polygons ──')
    poly = fetch_layer(BASE_POLY, country)
    all_features.extend(poly)

    print(f'\n── {country} points ──')
    pts  = fetch_layer(BASE_POINT, country)
    all_features.extend(pts)

    print(f'   {country} total: {len(poly) + len(pts)} features')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
gj = {'type': 'FeatureCollection', 'features': all_features}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(gj, f, separators=(',', ':'))

size_mb = os.path.getsize(OUT) / 1_048_576
print(f'\n✓  {len(all_features)} features → {OUT}  ({size_mb:.1f} MB)')
print('Next: git add data/wdpa.geojson && git commit -m "Add WDPA protected areas data"')
