#!/usr/bin/env python3
"""Bulk-import the county GeoJSON into the PostGIS table.

Usage (keep the database URL out of git):
  pip install psycopg[binary]
  SUPABASE_DB_URL='postgresql://...' python scripts/import_csb_supabase.py data/csb/brookings-csb.geojson
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg


def main() -> None:
    if not os.environ.get("SUPABASE_DB_URL"):
        raise SystemExit("Set SUPABASE_DB_URL to the Supabase Postgres connection string")
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/csb/brookings-csb.geojson")
    collection = json.loads(source.read_text())
    rows = []
    for feature in collection["features"]:
        props = feature.get("properties", {})
        rows.append((props.get("CSBID"), props.get("source_release", "USDA NASS CSB 2018-2025"), str(props.get("STATEFIPS", "46")), str(props.get("CNTYFIPS", "011")), props.get("CSBACRES"), json.dumps(feature["geometry"]), *[props.get(f"CDL{year}") for year in range(2018, 2026)]))
    sql = """
      insert into public.csb_boundaries (csbid, source_release, state_fips, county_fips, acres, geom, crop_2018, crop_2019, crop_2020, crop_2021, crop_2022, crop_2023, crop_2024, crop_2025)
      values (%s,%s,%s,%s,%s, extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(%s),4326)),%s,%s,%s,%s,%s,%s,%s,%s)
      on conflict (csbid) do update set geom=excluded.geom, acres=excluded.acres, source_release=excluded.source_release,
        crop_2018=excluded.crop_2018, crop_2019=excluded.crop_2019, crop_2020=excluded.crop_2020, crop_2021=excluded.crop_2021,
        crop_2022=excluded.crop_2022, crop_2023=excluded.crop_2023, crop_2024=excluded.crop_2024, crop_2025=excluded.crop_2025
    """
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, rows)
    print(f"Imported {len(rows):,} CSB polygons")


if __name__ == "__main__":
    main()
