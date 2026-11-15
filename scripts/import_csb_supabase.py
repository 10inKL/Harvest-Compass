#!/usr/bin/env python3
"""Bulk-import the county GeoJSON into the PostGIS table.

Usage (keep the database URL out of git):
  pip install psycopg[binary]
  SUPABASE_DB_URL='postgresql://...' python scripts/import_csb_supabase.py data/csb/brookings-csb.geojson
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import ijson
import psycopg
from dotenv import load_dotenv


def main() -> None:
    load_dotenv(".env.local")
    if not os.environ.get("SUPABASE_DB_URL"):
        raise SystemExit("Set SUPABASE_DB_URL to the Supabase Postgres connection string")
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/csb/south-dakota-selected-counties.geojson")
    import json
    sql = """
      insert into public.csb_boundaries (csbid, source_release, state_fips, county_fips, acres, geom, crop_2018, crop_2019, crop_2020, crop_2021, crop_2022, crop_2023, crop_2024, crop_2025)
      values (%s,%s,%s,%s,%s, extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(%s),4326)),%s,%s,%s,%s,%s,%s,%s,%s)
      on conflict (csbid) do update set geom=excluded.geom, acres=excluded.acres, source_release=excluded.source_release,
        crop_2018=excluded.crop_2018, crop_2019=excluded.crop_2019, crop_2020=excluded.crop_2020, crop_2021=excluded.crop_2021,
        crop_2022=excluded.crop_2022, crop_2023=excluded.crop_2023, crop_2024=excluded.crop_2024, crop_2025=excluded.crop_2025
    """
    count = 0
    with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as connection, source.open("rb") as data:
        with connection.cursor() as cursor:
            cursor.execute("select pg_database_size(current_database())")
            used_bytes = cursor.fetchone()[0]
            free_limit = 500 * 1024 * 1024
            reserve = 150 * 1024 * 1024
            conservative_import = 120 * 1024 * 1024
            print(f"Current database: {used_bytes / 1048576:.1f} MiB; estimated county import: up to 120 MiB; reserved for farm data: 150 MiB", flush=True)
            if used_bytes + conservative_import + reserve > free_limit:
                raise SystemExit("Import stopped: estimated storage would leave less than 150 MiB for farmer records within the Free allowance")
            migration = Path("supabase/migrations/202611150004_csb_boundaries.sql").read_text()
            cursor.execute(migration)
            connection.commit()
            batch = []
            for feature in ijson.items(data, "features.item", use_float=True):
                props = feature.get("properties", {})
                batch.append((props.get("CSBID"), props.get("source_release", "USDA NASS CSB 2018-2025"), str(props.get("STATEFIPS", "46")), str(props.get("CNTYFIPS", "011")), props.get("CSBACRES"), json.dumps(feature["geometry"]), *[props.get(f"CDL{year}") for year in range(2018, 2026)]))
                if len(batch) == 500:
                    cursor.executemany(sql, batch)
                    connection.commit()
                    count += len(batch)
                    print(f"Imported {count:,} CSB polygons", flush=True)
                    batch.clear()
            if batch:
                cursor.executemany(sql, batch)
                connection.commit()
                count += len(batch)
    print(f"Finished {count:,} CSB polygons")


if __name__ == "__main__":
    main()
