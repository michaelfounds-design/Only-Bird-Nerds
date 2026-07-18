"""
Fetches IUCN Red List conservation status for every species in your
eBird export and saves the results to iucn_data.json.

Usage:
    python build_iucn_data.py MyEBirdData.csv

Commit the generated iucn_data.json to update the site.
Re-run whenever you add many new species.
"""

import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request

TOKEN = 'bWx1CLru5ipmfp1myry31UP5YG4nbJ3VGdxk'
OUT   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'iucn_data.json')


def fetch_status(sci):
    url = ('https://apiv3.iucnredlist.org/api/v3/species/'
           + urllib.parse.quote(sci) + '?token=' + TOKEN)
    try:
        with urllib.request.urlopen(url, timeout=12) as r:
            d = json.loads(r.read())
            if d.get('result'):
                return d['result'][0].get('category')
    except Exception as e:
        print(f'    error: {e}')
    return None


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'MyEBirdData.csv'
    if not os.path.exists(csv_path):
        sys.exit(f'Cannot find {csv_path}\nUsage: python build_iucn_data.py MyEBirdData.csv')

    sci_names = set()
    with open(csv_path, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            name = row.get('Scientific Name', '').strip()
            if name:
                sci_names.add(name)

    names = sorted(sci_names)
    print(f'Found {len(names)} species — fetching IUCN status (~{len(names)//3}s)...\n')

    result = {}
    for i, sci in enumerate(names, 1):
        cat = fetch_status(sci)
        tag = f'  [{i:>3}/{len(names)}] {sci}'
        if cat and cat != 'LC':
            result[sci] = cat
            print(f'{tag}  →  {cat}')
        else:
            print(f'{tag}  →  LC')
        time.sleep(0.35)

    with open(OUT, 'w') as f:
        json.dump(result, f, sort_keys=True, indent=2)

    print(f'\nSaved {len(result)} threatened species to iucn_data.json')
    print('Now commit iucn_data.json and push to update the site.')


if __name__ == '__main__':
    main()
