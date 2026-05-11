"""
Migração específica de Rotas (Milkrun) — Firebase Firestore → SQL Server.
Pode rodar sozinho sem executar a migração completa.

Uso:
    python migrate_routes.py              # migração real
    DRY_RUN=true python migrate_routes.py # simulação
"""

import sys
import os

# Adiciona o diretório atual ao path para importar módulos irmãos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import DRY_RUN
from firestore_reader import read_companies, read_sectors, read_routes
from sql_writer import SqlWriter


def parse_shift(shift_str):
    """Converte shift string ('1° NORMAL') → int (0-3)."""
    import re
    if not shift_str:
        return 0
    shift_str = str(shift_str).upper().replace(" ", "").replace("°", "")
    mapping = {
        "1NORMAL": 0, "2NORMAL": 1,
        "1ESPECIAL": 2, "2ESPECIAL": 3,
        "1°NORMAL": 0, "2°NORMAL": 1,
        "1°ESPECIAL": 2, "2°ESPECIAL": 3,
    }
    mapped = mapping.get(shift_str)
    if mapped is not None:
        return mapped
    match = re.search(r"(\d+)", shift_str)
    return int(match.group(1)) - 1 if match else 0


def parse_date(raw_date):
    """Converte data do Firestore (pode ser string, timestamp dict, ou datetime)."""
    from datetime import datetime, timezone

    if raw_date is None:
        return "fixed"

    # Já é string
    if isinstance(raw_date, str):
        return raw_date

    # Firestore timestamp: { seconds, nanoseconds }
    if isinstance(raw_date, dict) and "seconds" in raw_date:
        dt = datetime.fromtimestamp(
            raw_date["seconds"] + raw_date.get("nanoseconds", 0) / 1e9,
            tz=timezone.utc
        )
        return dt.strftime("%Y-%m-%d")

    # Já é datetime
    if isinstance(raw_date, datetime):
        return raw_date.strftime("%Y-%m-%d")

    return "fixed"


def generate_uuid(seed=""):
    import uuid
    if seed:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"frotacontrol.migration.{seed}"))
    return str(uuid.uuid4())


def migrate_routes(sql: SqlWriter):
    print("=" * 60)
    print("Migração de Rotas (Milkrun)")
    print("=" * 60)

    print("\n[1] Lendo empresas...")
    companies = read_companies()
    print(f"  {len(companies)} empresa(s) encontrada(s)")

    total_routes = 0
    total_trips = 0
    total_stops = 0

    for comp in companies:
        cid = comp["_doc_id"]
        cname = comp.get("name", cid)
        print(f"\n  Empresa: {cid} ({cname})")

        sectors = read_sectors(cid)
        print(f"    {len(sectors)} setor(es)")

        for sec in sectors:
            sid = sec["_doc_id"]
            sname = sec.get("name", sid)

            routes = read_routes(cid, sid)
            if not routes:
                continue

            print(f"    Setor: {sid} ({sname}) → {len(routes)} rota(s)")

            for route in routes:
                route_doc_id = route["_doc_id"]
                vehicle_id = route.get("vehicleId", "")
                raw_date = route.get("date")
                date = parse_date(raw_date)
                shift = parse_shift(route.get("shift"))

                # isFixed: pode vir como True/False, "true"/"false", ou 1/0
                is_fixed_val = route.get("isFixed", False)
                if isinstance(is_fixed_val, str):
                    is_fixed = is_fixed_val.lower() == "true"
                else:
                    is_fixed = bool(is_fixed_val)

                route_guid = generate_uuid(f"route.{cid}.{sid}.{route_doc_id}")
                sql.insert_route(route_guid, cid, sid, vehicle_id,
                                date, shift, is_fixed)

                trips = route.get("trips", [])
                if isinstance(trips, dict):
                    # Firestore pode retornar map com chaves numéricas
                    trips = [trips[k] for k in sorted(trips.keys(), key=int)
                            if isinstance(trips[k], dict)]

                for t_idx, trip in enumerate(trips or []):
                    if not isinstance(trip, dict):
                        continue
                    trip_name = trip.get("name", f"Viagem {t_idx + 1}")
                    trip_id_str = str(trip.get("id", t_idx))
                    trip_guid = generate_uuid(f"trip.{route_guid}.{trip_id_str}")
                    sql.insert_route_trip(trip_guid, route_guid, trip_name, t_idx)

                    stops = trip.get("stops", [])
                    if isinstance(stops, dict):
                        stops = [stops[k] for k in sorted(stops.keys(), key=int)
                                if isinstance(stops[k], dict)]

                    for s_idx, stop in enumerate(stops or []):
                        if not isinstance(stop, dict):
                            continue
                        sql.insert_route_trip_stop(
                            trip_guid, s_idx,
                            str(stop.get("name", "")),
                            str(stop.get("plannedArrival", "00:00")),
                            str(stop.get("plannedDeparture", "00:00"))
                        )
                        total_stops += 1

                    total_trips += 1

                total_routes += 1
                print(f"      [OK] {route_doc_id} | {vehicle_id} | {date} | "
                      f"shift={shift} | fixed={is_fixed} | "
                      f"{len(trips or [])} trips | {total_stops} stops")

            sql.commit()

    sql.commit()
    print(f"\n{'=' * 60}")
    print(f"Total: {total_routes} rotas, {total_trips} viagens, {total_stops} paradas")
    print(f"{'=' * 60}")


def main():
    sql = SqlWriter()
    sql.connect()

    try:
        migrate_routes(sql)
    finally:
        sql.print_stats()
        sql.close()

    if DRY_RUN:
        print("\n[DRY RUN] Nenhum dado foi realmente inserido.")
    else:
        print("\nMigração de rotas concluída!")


if __name__ == "__main__":
    main()
