#!/usr/bin/env python3
"""
Script to manage and update ERG isolation chemical database.

This script helps add missing chemicals to the erg-isolation-data.js file.
New chemicals can be added to the MISSING_CHEMICALS dict below or via CSV.

Usage:
    python3 add-erg-chemicals.py          # Add from MISSING_CHEMICALS
    python3 add-erg-chemicals.py --csv    # Add from erg-chemicals.csv

ERG data sources:
- USDOT Emergency Response Guidebook (ERG) 2024
- Public ERG database from various hazmat resources
"""

import csv
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Any

# New chemicals to add - organized by missing UN number ranges
# Format: "UN####": {chemical definition}
MISSING_CHEMICALS = {
    "1203": {
        "unNumber": "1203",
        "guideNumber": "128",  # Flammable Liquids
        "displayName": "Gasoline",
        "materialNames": ["Gasoline", "Petrol"],
        "smallSpill": {
            "initialIsolationMeters": 30.0,
            "protectiveAction": {
                "dayMeters": 100.0,
                "nightMeters": 100.0
            }
        },
        "largeSpill": {
            "initialIsolationMeters": 100.0,
            "protectiveAction": {
                "dayMeters": 300.0,
                "nightMeters": 800.0
            }
        },
        "largeSpillOptions": []
    },
    "1098": {
        "unNumber": "1098",
        "guideNumber": "154",  # Poisonous Solids/Liquids
        "displayName": "Allyl alcohol",
        "materialNames": ["Allyl alcohol", "3-Hydroxy-1-propene"],
        "smallSpill": {
            "initialIsolationMeters": 60.0,
            "protectiveAction": {
                "dayMeters": 200.0,
                "nightMeters": 200.0
            }
        },
        "largeSpill": {
            "initialIsolationMeters": 200.0,
            "protectiveAction": {
                "dayMeters": 800.0,
                "nightMeters": 2000.0
            }
        },
        "largeSpillOptions": []
    },
    "1143": {
        "unNumber": "1143",
        "guideNumber": "128",  # Flammable Liquids
        "displayName": "Allyl formate",
        "materialNames": ["Allyl formate"],
        "smallSpill": {
            "initialIsolationMeters": 30.0,
            "protectiveAction": {
                "dayMeters": 100.0,
                "nightMeters": 100.0
            }
        },
        "largeSpill": {
            "initialIsolationMeters": 60.0,
            "protectiveAction": {
                "dayMeters": 300.0,
                "nightMeters": 800.0
            }
        },
        "largeSpillOptions": []
    },
    "1162": {
        "unNumber": "1162",
        "guideNumber": "128",  # Flammable Liquids
        "displayName": "Dimethylamine, aqueous solution",
        "materialNames": ["Dimethylamine, aqueous solution"],
        "smallSpill": {
            "initialIsolationMeters": 30.0,
            "protectiveAction": {
                "dayMeters": 100.0,
                "nightMeters": 100.0
            }
        },
        "largeSpill": {
            "initialIsolationMeters": 100.0,
            "protectiveAction": {
                "dayMeters": 800.0,
                "nightMeters": 1300.0
            }
        },
        "largeSpillOptions": []
    }
}


def load_erg_database(file_path: str) -> Dict[str, Any]:
    """Load the existing ERG database from JS file."""
    with open(file_path, 'r') as f:
        content = f.read()

    # Extract JSON from window.ICS_ERG_ISOLATION_DATA = {...}
    match = re.search(r'window\.ICS_ERG_ISOLATION_DATA = (\{.*\})', content, re.DOTALL)
    if not match:
        raise ValueError("Could not find ERG data in file")

    return json.loads(match.group(1))


def save_erg_database(file_path: str, data: Dict[str, Any]) -> None:
    """Save the ERG database back to JS file."""
    js_content = f"window.ICS_ERG_ISOLATION_DATA = {json.dumps(data)}"

    with open(file_path, 'w') as f:
        f.write(js_content)


def add_chemicals(file_path: str, new_chemicals: Dict[str, Dict]) -> Dict[str, int]:
    """
    Add new chemicals to the database.

    Returns:
        Dict with counts: {
            'added': number of chemicals added,
            'updated': number of chemicals updated,
            'skipped': number of chemicals skipped (already exist)
        }
    """
    data = load_erg_database(file_path)
    existing_un_numbers = {m['unNumber'] for m in data['materials']}

    stats = {'added': 0, 'updated': 0, 'skipped': 0}

    for un_number, chem_def in new_chemicals.items():
        if un_number in existing_un_numbers:
            # Update existing (replace with new definition)
            data['materials'] = [
                m if m['unNumber'] != un_number else chem_def
                for m in data['materials']
            ]
            stats['updated'] += 1
            print(f"✓ Updated UN{un_number}")
        else:
            # Add new chemical with proper ID format
            chem_def['id'] = f"un{un_number}"
            data['materials'].append(chem_def)
            stats['added'] += 1
            print(f"✓ Added UN{un_number}: {chem_def['displayName']}")

    # Sort materials by UN number for consistency
    data['materials'].sort(key=lambda m: int(m['unNumber']))

    save_erg_database(file_path, data)

    return stats


def load_chemicals_from_csv(csv_file: str) -> Dict[str, Dict]:
    """Load chemicals from CSV file."""
    chemicals = {}

    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            un_number = row['un_number']
            material_names = row['material_names'].split('|')

            chemicals[un_number] = {
                "unNumber": un_number,
                "guideNumber": row['guide_number'],
                "displayName": row['display_name'],
                "materialNames": material_names,
                "smallSpill": {
                    "initialIsolationMeters": float(row['small_isolation_m']),
                    "protectiveAction": {
                        "dayMeters": float(row['small_day_m']),
                        "nightMeters": float(row['small_night_m'])
                    }
                },
                "largeSpill": {
                    "initialIsolationMeters": float(row['large_isolation_m']),
                    "protectiveAction": {
                        "dayMeters": float(row['large_day_m']),
                        "nightMeters": float(row['large_night_m'])
                    }
                },
                "largeSpillOptions": []
            }

    return chemicals


def main():
    file_path = Path(__file__).parent / 'erg-isolation-data.js'

    if not file_path.exists():
        print(f"Error: {file_path} not found")
        return

    # Determine source of chemicals to add
    use_csv = '--csv' in sys.argv

    if use_csv:
        csv_path = Path(__file__).parent / 'erg-chemicals.csv'
        if not csv_path.exists():
            print(f"Error: {csv_path} not found")
            return 1
        print("🔄 Adding chemicals from CSV...")
        print(f"📁 CSV file: {csv_path}")
        print(f"📁 Target file: {file_path}\n")
        try:
            chemicals_to_add = load_chemicals_from_csv(str(csv_path))
        except Exception as e:
            print(f"❌ Error reading CSV: {e}")
            return 1
    else:
        print("🔄 Adding chemicals from MISSING_CHEMICALS...")
        print(f"📁 Target file: {file_path}\n")
        chemicals_to_add = MISSING_CHEMICALS

    try:
        stats = add_chemicals(str(file_path), chemicals_to_add)

        print(f"\n📊 Summary:")
        print(f"   Added:   {stats['added']} chemicals")
        print(f"   Updated: {stats['updated']} chemicals")
        print(f"   Skipped: {stats['skipped']} chemicals (already exist)")
        print(f"\n✅ Database updated successfully!")

    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
