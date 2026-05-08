"""
Script principal de migração Firebase → SQL Server.
Ordem: Companies → Sectors → Groups → Users → Vehicles → Maintenance
       → Routes → Checklists → Runs → Refuels → Managers → Fuel Cards

Uso:
    python migrate.py                          # migração completa
    DRY_RUN=true python migrate.py             # apenas simulação
    python migrate.py --firestore-only         # apenas dados do Firestore (truck)
    python migrate.py --rtdb-only              # apenas dados do RTDB (car)
"""

import sys
import uuid
import json
import re
from datetime import datetime, timezone, timedelta

from config import DRY_RUN
from firestore_reader import (
    read_companies, read_sectors, read_users, read_vehicles,
    read_maintenance, read_checklists, read_runs, read_routes,
    read_refuels, read_managers
)
from rtdb_reader import (
    read_empresas, read_setores, read_grupos, read_grupos_setores,
    read_car_users, read_car_vehicles, read_car_fuel_cards
)
from sql_writer import SqlWriter


# ====================================================================
# Helpers de transformação
# ====================================================================

def parse_shift(shift_str: str | None) -> int:
    """Converte shift string ('1° NORMAL') → int (1)."""
    if not shift_str:
        return 1
    match = re.search(r"(\d+)", str(shift_str))
    return int(match.group(1)) if match else 1


def parse_timestamp(ts) -> datetime | None:
    """Converte timestamp do Firestore (objeto ou string) para datetime UTC."""
    if ts is None:
        return None
    # Firestore REST já retorna datetime
    if isinstance(ts, datetime):
        return ts
    # Firestore SDK timestamp: { seconds, nanoseconds }
    if isinstance(ts, dict) and "seconds" in ts:
        return datetime.fromtimestamp(ts["seconds"] + ts.get("nanoseconds", 0) / 1e9, tz=timezone.utc)
    # String ISO
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def parse_vehicle_status(status_str: str | None) -> int:
    """String status → int enum. Firebase salva como string."""
    if not status_str:
        return 0
    mapping = {
        "PARADO": 0,
        "EM_CORRIDA": 1,
        "EM_MANUTENCAO": 2,
        "BLOQUEADO_CHECKLIST": 3,
    }
    return mapping.get(status_str.upper(), 0)


def parse_run_status(status_str: str | None) -> int:
    if not status_str:
        return 0
    mapping = {"IN_PROGRESS": 0, "COMPLETED": 1, "CANCELED": 2}
    return mapping.get(status_str.upper(), 0)


def parse_stop_status(status_str: str | None) -> int:
    if not status_str:
        return 0
    mapping = {"PENDING": 0, "IN_PROGRESS": 1, "COMPLETED": 2, "CANCELED": 3}
    return mapping.get(status_str.upper(), 0)


def parse_item_status(status_str: str | None) -> int:
    if not status_str:
        return 0
    mapping = {"conforme": 0, "nao_conforme": 1, "na": 2}
    return mapping.get(status_str, 0)


def parse_rtdb_date_time(date_str: str, time_str: str) -> tuple[str, str]:
    """Converte data DD/MM/YYYY e hora HH:mm do RTDB para formatos SQL."""
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%d/%m/%Y %H:%M")
        return dt.strftime("%Y-%m-%d"), time_str
    except (ValueError, AttributeError):
        return "2000-01-01", "00:00"


def parse_rtdb_date(date_str: str) -> str:
    """Converte data DD/MM/YYYY do RTDB para YYYY-MM-DD."""
    try:
        return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return "2000-01-01"


def generate_uuid(seed: str = "") -> str:
    """Gera UUID determinístico baseado em seed, ou aleatório."""
    if seed:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"frotacontrol.migration.{seed}"))
    return str(uuid.uuid4())


# ====================================================================
# Migração Firestore (Truck App)
# ====================================================================

def migrate_firestore(sql: SqlWriter):
    print("\n=== Migração Firestore ===")

    # 1. Companies + Sectors
    print("\n[1] Companies e Sectors")
    companies = read_companies()
    for comp in companies:
        cid = comp["_doc_id"]
        cname = comp.get("name", cid)
        print(f"  Empresa: {cid} ({cname})")
        sql.insert_company(cid, cname)

        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            sname = sec.get("name", sid)
            print(f"    Setor: {sid} ({sname})")
            sql.insert_sector(sid, cid, sname)

    sql.commit()

    # 2. Users (requer Companies + Sectors existentes)
    print("\n[2] Users")
    identity_created = set()

    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            users = read_users(cid, sid)
            for user in users:
                uid = user["_doc_id"]  # Firebase Auth UID
                name = user.get("name", "Sem Nome")
                matricula = user.get("matricula", uid[:8])
                shift = parse_shift(user.get("shift"))
                is_admin = user.get("isAdmin", False)
                is_truck = user.get("truck", True)
                is_op = user.get("isOP", False)
                photo_url = user.get("photoURL")
                email = user.get("email") or f"{matricula}@frotacontrol.com"

                if uid not in identity_created:
                    sql.insert_identity_user(uid, matricula, name)
                    identity_created.add(uid)

                sql.insert_user_profile(
                    uid, cid, sid, name, matricula, shift,
                    is_admin, is_truck, is_op,
                    photo_url, email, None  # permitidos via RTDB ou vazio
                )
                print(f"    User: {matricula} ({name}) [{cid}/{sid}]")

    sql.commit()

    # 3. Vehicles + Maintenance
    print("\n[3] Vehicles e Maintenance")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            vehicles = read_vehicles(cid, sid)
            for veh in vehicles:
                vid = veh["_doc_id"]
                model = veh.get("model", vid)
                is_truck = veh.get("isTruck", True)
                status = parse_vehicle_status(veh.get("status"))

                sql.insert_vehicle(vid, cid, sid, model, is_truck, status)
                print(f"    Vehicle: {vid} ({model}) status={status}")

                # Maintenance records
                maint_records = read_maintenance(cid, sid, vid)
                for m in maint_records:
                    raw_id = m["_doc_id"]
                    mid = generate_uuid(f"maintenance.{cid}.{sid}.{vid}.{raw_id}")
                    start_time = parse_timestamp(m.get("startTime"))
                    end_time = parse_timestamp(m.get("endTime"))
                    notes = m.get("notes")
                    sql.insert_maintenance(mid, vid, start_time, end_time, notes)
                    print(f"      Maintenance: {raw_id} -> {mid}")

    sql.commit()

    # 4. Routes (Milkrun)
    print("\n[4] Routes")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            routes = read_routes(cid, sid)
            for route in routes:
                route_doc_id = route["_doc_id"]
                vehicle_id = route.get("vehicleId", "")
                date = route.get("date", "fixed")
                shift = parse_shift(route.get("shift"))
                is_fixed = route.get("isFixed", False)

                route_guid = generate_uuid(f"route.{cid}.{sid}.{route_doc_id}")
                sql.insert_route(route_guid, cid, sid, vehicle_id, date, shift, is_fixed)

                trips = route.get("trips", [])
                for t_idx, trip in enumerate(trips or []):
                    trip_name = trip.get("name", f"Viagem {t_idx + 1}")
                    trip_id_str = trip.get("id", str(t_idx))
                    trip_guid = generate_uuid(f"trip.{route_guid}.{trip_id_str}")
                    sql.insert_route_trip(trip_guid, route_guid, trip_name, t_idx)

                    stops = trip.get("stops", [])
                    for s_idx, stop in enumerate(stops or []):
                        sql.insert_route_trip_stop(
                            trip_guid, s_idx,
                            stop.get("name", ""),
                            stop.get("plannedArrival", "00:00"),
                            stop.get("plannedDeparture", "00:00")
                        )
                print(f"    Route: {route_doc_id} ({len(trips)} trips)")

    sql.commit()

    # 5. Checklists
    print("\n[5] Checklists")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            vehicles = read_vehicles(cid, sid)
            for veh in vehicles:
                vid = veh["_doc_id"]
                checklists = read_checklists(cid, sid, vid)
                for cl in checklists:
                    cl_doc_id = cl["_doc_id"]
                    cl_guid = generate_uuid(f"checklist.{cid}.{sid}.{vid}.{cl_doc_id}")
                    driver_id = cl.get("driverId", "")
                    driver_name = cl.get("driverName", "")
                    timestamp = parse_timestamp(cl.get("timestamp"))

                    sql.insert_checklist(cl_guid, vid, driver_id, driver_name,
                                        timestamp, cid, sid)

                    items = cl.get("items", [])
                    for item in items or []:
                        images = item.get("images", [])
                        images_json = json.dumps(images) if images else None
                        sql.insert_checklist_item(
                            cl_guid,
                            str(item.get("id", "")),
                            str(item.get("location", "")),
                            item.get("title", ""),
                            item.get("description", ""),
                            parse_item_status(item.get("status")),
                            item.get("observation"),
                            images_json
                        )
                    print(f"    Checklist: {cl_doc_id} ({len(items)} items)")

    sql.commit()

    # 6. Runs
    print("\n[6] Runs")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            runs = read_runs(cid, sid)
            for run in runs:
                run_doc_id = run["_doc_id"]
                run_guid = generate_uuid(f"run.{cid}.{sid}.{run_doc_id}")
                driver_id = run.get("driverId", "")
                driver_name = run.get("driverName", "")
                vehicle_id = run.get("vehicleId", "")
                route_id_raw = run.get("routeId")
                route_id = generate_uuid(f"route.{cid}.{sid}.{route_id_raw}") if route_id_raw else None
                trip_id = run.get("tripId")
                trip_name = run.get("tripName")

                # Garante que o veículo existe (pode ter sido digitado manualmente)
                if vehicle_id and not sql._exists("Vehicles", "Id", vehicle_id):
                    sql.insert_vehicle(vehicle_id, cid, sid, vehicle_id, True, 0)
                    print(f"    [auto-criado] Vehicle: {vehicle_id}")
                shift = parse_shift(run.get("shift"))
                start_mileage = float(run.get("startMileage") or 0)
                start_time = parse_timestamp(run.get("startTime"))
                end_time = parse_timestamp(run.get("endTime"))
                end_mileage = float(run.get("endMileage") or 0) if run.get("endMileage") else None
                status = parse_run_status(run.get("status"))

                sql.insert_run(run_guid, driver_id, driver_name, vehicle_id,
                              route_id, trip_id, trip_name, shift,
                              start_mileage, start_time, end_time, end_mileage, status)

                # Stops
                stops = run.get("stops", [])
                for s_idx, stop in enumerate(stops or []):
                    sql.insert_run_stop(
                        run_guid, s_idx,
                        stop.get("name", ""),
                        parse_stop_status(stop.get("status")),
                        stop.get("plannedArrival"),
                        stop.get("plannedDeparture"),
                        parse_timestamp(stop.get("arrivalTime")),
                        parse_timestamp(stop.get("departureTime")),
                        stop.get("collectedOccupiedCars"),
                        stop.get("collectedEmptyCars"),
                        float(stop.get("mileageAtStop") or 0) if stop.get("mileageAtStop") else None,
                        stop.get("occupancy"),
                        stop.get("observation")
                    )

                # Location history
                location_history = run.get("locationHistory", [])
                for loc in location_history or []:
                    lat = float(loc.get("latitude") or 0)
                    lng = float(loc.get("longitude") or 0)
                    loc_ts = parse_timestamp(loc.get("timestamp"))
                    if loc_ts:
                        sql.insert_location_point(run_guid, lat, lng, loc_ts)

                print(f"    Run: {run_doc_id} status={status} stops={len(stops)} gps={len(location_history)}")

    sql.commit()

    # 7. Refuels
    print("\n[7] Refuels")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            refuels = read_refuels(cid, sid)
            for ref in refuels:
                ref_doc_id = ref["_doc_id"]
                ref_guid = generate_uuid(f"refuel.{cid}.{sid}.{ref_doc_id}")
                driver_id = ref.get("driverId", "")
                driver_name = ref.get("driverName", "")
                vehicle_id = ref.get("vehicleId", "")
                liters = float(ref.get("liters") or 0)
                amount = float(ref.get("amount") or 0)
                timestamp = parse_timestamp(ref.get("timestamp"))

                sql.insert_refuel(ref_guid, cid, sid, vehicle_id, driver_id,
                                 driver_name, liters, amount, timestamp)
                print(f"    Refuel: {ref_doc_id} {liters}L")

    sql.commit()

    # 8. Managers
    print("\n[8] Managers")
    for comp in companies:
        cid = comp["_doc_id"]
        sectors = read_sectors(cid)
        for sec in sectors:
            sid = sec["_doc_id"]
            managers = read_managers(cid, sid)
            for mgr in managers:
                mgr_doc_id = mgr["_doc_id"]
                mgr_guid = generate_uuid(f"manager.{cid}.{sid}.{mgr_doc_id}")
                name = mgr.get("name", "")
                email = mgr.get("email", "")
                sql.insert_manager(mgr_guid, cid, sid, name, email)
                print(f"    Manager: {name} ({email})")

    sql.commit()
    print("  Firestore concluído.")


# ====================================================================
# Migração RTDB (Car App — Legacy)
# ====================================================================

def migrate_rtdb(sql: SqlWriter):
    print("\n=== Migração RTDB (Car App) ===")

    empresas = read_empresas()
    if not empresas:
        print("  Nenhuma empresa encontrada no RTDB.")
        return

    for empresa in empresas:
        print(f"\n  Empresa: {empresa}")

        # Garantir que a empresa existe no SQL
        sql.insert_company(empresa, empresa)

        # Grupos
        grupos = read_grupos(empresa)
        grupos_setores = read_grupos_setores(empresa)
        for gid, gdata in grupos.items():
            gname = gdata.get("nome", gid) if isinstance(gdata, dict) else gid
            sql.insert_group(gid, empresa, gname)
            print(f"    Grupo: {gid} ({gname})")

        # Setores
        setores = read_setores(empresa)
        for setor in setores:
            print(f"    Setor: {setor}")
            sql.insert_sector(setor, empresa, setor)

            # SectorGroup mapping
            if setor in grupos_setores:
                sql.insert_sector_group(setor, grupos_setores[setor])

            # ---- Car Users ----
            car_users = read_car_users(empresa, setor)
            for cu in car_users:
                matricula = cu.get("_matricula", "")
                nome = cu.get("nome", matricula)
                adm = cu.get("adm", False)
                op = cu.get("op", False)
                truck = cu.get("truck", False)
                permitidos = cu.get("permitidos", [])
                permitidos_json = json.dumps(permitidos) if permitidos else None

                # Gera ID determinístico para car users (não têm Firebase Auth UID)
                user_guid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"rtdb.user.{empresa}.{setor}.{matricula}"))
                email = f"{matricula}@frotacontrol.com"

                sql.insert_identity_user(user_guid, matricula, nome)
                sql.insert_user_profile(
                    user_guid, empresa, setor, nome, matricula, 1,
                    adm, truck or True, op,
                    None, email, permitidos_json
                )
                print(f"      Car User: {matricula} ({nome})")

            # ---- Car Vehicles ----
            car_vehicles = read_car_vehicles(empresa, setor)
            for cv in car_vehicles:
                nome = cv.get("_nome", "")
                modelo = cv.get("modelo", nome)
                status_str = cv.get("status", "PARADO")

                # Mapeia status legado do carro
                status = 0  # PARADO
                if status_str and "CORRIDA" in status_str.upper():
                    status = 1
                elif status_str and "MANUT" in status_str.upper():
                    status = 2

                sql.insert_vehicle(nome, empresa, setor, modelo, True, status)
                print(f"      Car Vehicle: {nome} ({modelo})")

            # ---- Fuel Cards ----
            fuel_cards = read_car_fuel_cards(empresa, setor)
            for veiculo_key, card_data in fuel_cards.items():
                if not isinstance(card_data, dict):
                    continue
                balance = float(card_data.get("saldo", 0) or 0)
                sql.insert_fuel_card(veiculo_key, empresa, setor, balance)

                recargas = card_data.get("recargas", {})
                if isinstance(recargas, dict):
                    for rec_id, rec in recargas.items():
                        if not isinstance(rec, dict):
                            continue
                        valor = float(rec.get("valor", 0) or 0)
                        data_str = rec.get("data", "01/01/2000")
                        hora_str = rec.get("hora", "00:00")
                        responsavel = rec.get("responsavel", "")
                        date_sql, time_sql = parse_rtdb_date_time(data_str, hora_str)

                        rec_guid = generate_uuid(f"fuelrec.{empresa}.{setor}.{veiculo_key}.{rec_id}")
                        sql.insert_fuel_card_recharge(
                            rec_guid, veiculo_key, valor, date_sql, time_sql, responsavel
                        )
                print(f"      FuelCard: {veiculo_key} saldo={balance} recargas={len(recargas) if isinstance(recargas, dict) else 0}")

    sql.commit()
    print("  RTDB concluído.")


# ====================================================================
# Main
# ====================================================================

def main():
    firestore_only = "--firestore-only" in sys.argv
    rtdb_only = "--rtdb-only" in sys.argv
    do_both = not firestore_only and not rtdb_only

    sql = SqlWriter()
    sql.connect()

    try:
        if do_both or firestore_only:
            migrate_firestore(sql)
        if do_both or rtdb_only:
            migrate_rtdb(sql)
    finally:
        sql.print_stats()
        sql.close()

    if DRY_RUN:
        print("\n[DRY RUN] Nenhum dado foi realmente inserido.")
    else:
        print("\nMigração concluída com sucesso!")


if __name__ == "__main__":
    main()
