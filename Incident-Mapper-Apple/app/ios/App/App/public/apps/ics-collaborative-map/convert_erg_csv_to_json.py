#!/usr/bin/env python3
"""
Convert ERG CSV data to JSON format for Isolation Tool.

Reads erg_materials.csv and converts to erg-isolation-data.js format,
handling all ERG table types (standard, Table 2 TIH, Table 3 wind-dependent, BLEVE).
"""

import csv
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List


def read_csv(csv_path: str) -> List[Dict[str, str]]:
    """Read CSV file and return list of row dictionaries."""
    rows = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def safe_float(value: str) -> Optional[float]:
    """Convert string to float, return None if empty or invalid."""
    if not value or value.strip() == '':
        return None
    try:
        return float(value.strip())
    except ValueError:
        return None


def build_bleve_distances(row: Dict[str, str]) -> Optional[Dict[str, float]]:
    """Build BLEVE distance map for various container capacities."""
    bleve_capacities = [
        ('blv_100', 100),
        ('blv_400', 400),
        ('blv_2000', 2000),
        ('blv_4000', 4000),
        ('blv_8000', 8000),
        ('blv_22000', 22000),
        ('blv_42000', 42000),
        ('blv_82000', 82000),
        ('blv_140000', 140000),
    ]

    bleve_distances = {}
    for field, capacity in bleve_capacities:
        distance = safe_float(row.get(field, ''))
        if distance is not None:
            bleve_distances[f"{capacity}L"] = distance

    return bleve_distances if bleve_distances else None


def build_table3_options(row: Dict[str, str]) -> Optional[List[Dict[str, Any]]]:
    """Build Table 3 (wind-speed dependent) options for large spills."""
    if row.get('table3') != 'Yes':
        return None

    options = []

    # Rail tank car
    rail_iso = safe_float(row.get('rail_iso', ''))
    if rail_iso is not None:
        options.append({
            'transportContainer': 'Rail tank car',
            'initialIsolationMeters': rail_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('rail_dy_low', '')),
                    'moderateMeters': safe_float(row.get('rail_dy_mod', '')),
                    'highMeters': safe_float(row.get('rail_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('rail_nte_low', '')),
                    'moderateMeters': safe_float(row.get('rail_nte_mod', '')),
                    'highMeters': safe_float(row.get('rail_nte_hi', ''))
                }
            }
        })

    # Semi/Highway tank truck
    semi_iso = safe_float(row.get('semi_iso', ''))
    if semi_iso is not None:
        options.append({
            'transportContainer': 'Highway tank truck or trailer',
            'initialIsolationMeters': semi_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('semi_dy_low', '')),
                    'moderateMeters': safe_float(row.get('semi_dy_mod', '')),
                    'highMeters': safe_float(row.get('semi_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('semi_nte_low', '')),
                    'moderateMeters': safe_float(row.get('semi_nte_mod', '')),
                    'highMeters': safe_float(row.get('semi_nte_hi', ''))
                }
            }
        })

    # Single ton cylinder
    ston_iso = safe_float(row.get('ston_iso', ''))
    if ston_iso is not None:
        options.append({
            'transportContainer': 'Single ton cylinder',
            'initialIsolationMeters': ston_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('ston_dy_low', '')),
                    'moderateMeters': safe_float(row.get('ston_dy_mod', '')),
                    'highMeters': safe_float(row.get('ston_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('ston_nte_low', '')),
                    'moderateMeters': safe_float(row.get('ston_nte_mod', '')),
                    'highMeters': safe_float(row.get('ston_nte_hi', ''))
                }
            }
        })

    # Multiple ton cylinders
    mton_iso = safe_float(row.get('mton_iso', ''))
    if mton_iso is not None:
        options.append({
            'transportContainer': 'Multiple ton cylinders',
            'initialIsolationMeters': mton_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('mton_dy_low', '')),
                    'moderateMeters': safe_float(row.get('mton_dy_mod', '')),
                    'highMeters': safe_float(row.get('mton_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('mton_nte_low', '')),
                    'moderateMeters': safe_float(row.get('mton_nte_mod', '')),
                    'highMeters': safe_float(row.get('mton_nte_hi', ''))
                }
            }
        })

    # Agricultural equipment/application
    ag_iso = safe_float(row.get('ag_iso', ''))
    if ag_iso is not None:
        options.append({
            'transportContainer': 'Agricultural equipment',
            'initialIsolationMeters': ag_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('ag_dy_low', '')),
                    'moderateMeters': safe_float(row.get('ag_dy_mod', '')),
                    'highMeters': safe_float(row.get('ag_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('ag_nte_low', '')),
                    'moderateMeters': safe_float(row.get('ag_nte_mod', '')),
                    'highMeters': safe_float(row.get('ag_nte_hi', ''))
                }
            }
        })

    # Multiple small cylinders
    msm_iso = safe_float(row.get('msm_iso', ''))
    if msm_iso is not None:
        options.append({
            'transportContainer': 'Multiple small cylinders',
            'initialIsolationMeters': msm_iso,
            'protectiveAction': {
                'day': {
                    'lowMeters': safe_float(row.get('msm_dy_low', '')),
                    'moderateMeters': safe_float(row.get('msm_dy_mod', '')),
                    'highMeters': safe_float(row.get('msm_dy_hi', ''))
                },
                'night': {
                    'lowMeters': safe_float(row.get('msm_nte_low', '')),
                    'moderateMeters': safe_float(row.get('msm_nte_mod', '')),
                    'highMeters': safe_float(row.get('msm_nte_hi', ''))
                }
            }
        })

    return options if options else None


def convert_row_to_material(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Convert a CSV row to a material entry in JSON format."""
    un_number = row.get('mtl_id', '').strip()
    if not un_number:
        return None

    guide_num = row.get('guide_num', '').strip()
    name = row.get('name', '').strip()

    if not name:
        return None

    # Get distances
    sm_iso = safe_float(row.get('sm_iso', ''))
    lg_iso = safe_float(row.get('lg_iso', ''))
    fire_iso = safe_float(row.get('fire_iso', ''))
    sm_dy = safe_float(row.get('sm_dy', ''))
    sm_nte = safe_float(row.get('sm_nte', ''))
    lg_dy = safe_float(row.get('lg_dy', ''))
    lg_nte = safe_float(row.get('lg_nte', ''))

    # Build material entry
    material = {
        'id': f'un{un_number}',
        'unNumber': un_number,
        'guideNumber': guide_num,
        'displayName': name,
        'materialNames': [name],
    }

    # Small spill
    if sm_iso is not None:
        material['smallSpill'] = {
            'initialIsolationMeters': sm_iso,
            'protectiveAction': {
                'dayMeters': sm_dy,
                'nightMeters': sm_nte
            }
        }

    # Large spill
    lg_options = build_table3_options(row)
    if lg_options:
        # Table 3: store as largeSpillOptions
        material['largeSpill'] = None
        material['largeSpillOptions'] = lg_options
    elif lg_iso is not None:
        material['largeSpill'] = {
            'initialIsolationMeters': lg_iso,
            'protectiveAction': {
                'dayMeters': lg_dy,
                'nightMeters': lg_nte
            }
        }
        material['largeSpillOptions'] = []
    else:
        material['largeSpill'] = None
        material['largeSpillOptions'] = []

    # Fire isolation
    if fire_iso is not None:
        material['fireIsolationMeters'] = fire_iso

    # BLEVE
    if row.get('bleve') == 'Yes':
        bleve_dists = build_bleve_distances(row)
        if bleve_dists:
            material['bleveDistances'] = bleve_dists
        material['canBleve'] = True

    # Polymerize hazard
    if row.get('polymerize') == 'Yes':
        material['canPolymerize'] = True

    # Table 2 TIH replacement materials
    if row.get('table2') == 'Yes':
        tih_replacements = row.get('tih', '').strip()
        if tih_replacements:
            material['table2Replacements'] = [m.strip() for m in tih_replacements.split(',')]
        material['isTIH'] = True

    return material


def main():
    csv_path = '/Users/johnholtan/Downloads/erg_materials.csv'
    output_path = '/Volumes/Crucial X9/toolbox-site/Incident-Mapper-Apple/app/ios/App/App/public/apps/ics-collaborative-map/erg-isolation-data.js'

    print(f'📖 Reading CSV from {csv_path}...')
    rows = read_csv(csv_path)
    print(f'✅ Read {len(rows)} rows')

    print(f'\n🔄 Converting to JSON format...')
    materials = []
    skipped = 0

    for i, row in enumerate(rows, 1):
        material = convert_row_to_material(row)
        if material:
            materials.append(material)
        else:
            skipped += 1

        if i % 100 == 0:
            print(f'  Processed {i} rows ({len(materials)} valid, {skipped} skipped)')

    print(f'✅ Converted {len(materials)} materials ({skipped} skipped)')

    # Sort by UN number
    materials.sort(key=lambda m: int(m['unNumber']))

    # Build output structure
    output = {'materials': materials}

    # Write to file
    print(f'\n💾 Writing to {output_path}...')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('window.ICS_ERG_ISOLATION_DATA = ')
        f.write(json.dumps(output, separators=(',', ':')))

    print(f'✅ File written successfully')
    print(f'\n📊 Statistics:')
    print(f'  Total materials: {len(materials)}')
    print(f'  UN number range: {materials[0]["unNumber"]} - {materials[-1]["unNumber"]}')

    # Count features
    with_small = sum(1 for m in materials if m.get('smallSpill'))
    with_large = sum(1 for m in materials if m.get('largeSpill'))
    with_table3 = sum(1 for m in materials if m.get('largeSpillOptions') and len(m['largeSpillOptions']) > 0)
    with_bleve = sum(1 for m in materials if m.get('canBleve'))
    with_fire = sum(1 for m in materials if m.get('fireIsolationMeters'))

    print(f'  With small spill: {with_small}')
    print(f'  With large spill: {with_large}')
    print(f'  With Table 3 (wind-dependent): {with_table3}')
    print(f'  With BLEVE capability: {with_bleve}')
    print(f'  With fire isolation: {with_fire}')

    return 0


if __name__ == '__main__':
    sys.exit(main())
