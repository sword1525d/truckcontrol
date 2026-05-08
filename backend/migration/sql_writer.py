"""
Escritor SQL Server. Insere dados migrados nas tabelas do schema Frotacontrol.
Usa pyodbc com queries parametrizadas. Idempotente: verifica existência antes de inserir.
"""

import pyodbc
import json
import hashlib
import hmac
import base64
import os
from config import SQL_CONNECTION_STRING, DRY_RUN, DEFAULT_PASSWORD
from datetime import datetime, timezone


def hash_password_v3(password: str) -> str:
    """Gera hash compatível com ASP.NET Core Identity v3 (.NET 10)."""
    salt = os.urandom(16)
    iterations = 100_000
    subkey = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt, iterations, dklen=32)
    # .NET 10 format: [0x01][PRF BE4][iter BE4][saltLen BE4][salt 16B][subkey 32B]
    prf = 2  # KeyDerivationPrf.HMACSHA512
    header = b"\x01" + prf.to_bytes(4, "big") + iterations.to_bytes(4, "big") + (16).to_bytes(4, "big")
    return base64.b64encode(header + salt + subkey).decode("ascii")


class SqlWriter:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.counts = {}

    def connect(self):
        if DRY_RUN:
            print("  [DRY RUN] Conectaria ao SQL Server")
            return
        self.conn = pyodbc.connect(SQL_CONNECTION_STRING)
        self.cursor = self.conn.cursor()

    def close(self):
        if self.conn:
            self.conn.close()

    def _execute(self, sql: str, params: tuple = ()):
        """Executa SQL. Em DRY_RUN apenas loga."""
        if DRY_RUN:
            print(f"    SQL: {sql[:120]}... | params: {params}")
            return
        self.cursor.execute(sql, params)

    def _exists(self, table: str, column: str, value) -> bool:
        """Verifica se registro já existe."""
        if DRY_RUN:
            return False
        self.cursor.execute(f"SELECT COUNT(1) FROM {table} WHERE {column} = ?", (value,))
        return self.cursor.fetchone()[0] > 0

    def commit(self):
        if not DRY_RUN and self.conn:
            self.conn.commit()

    # ---- Companies ----

    def insert_company(self, company_id: str, name: str):
        if self._exists("Companies", "Id", company_id):
            return
        self._execute(
            "INSERT INTO Companies (Id, Name) VALUES (?, ?)",
            (company_id, name)
        )
        self._inc("companies")

    # ---- Sectors ----

    def insert_sector(self, sector_id: str, company_id: str, name: str):
        if self._exists("Sectors", "Id", sector_id):
            return
        self._execute(
            "INSERT INTO Sectors (Id, CompanyId, Name) VALUES (?, ?, ?)",
            (sector_id, company_id, name)
        )
        self._inc("sectors")

    # ---- Groups + SectorGroups ----

    def insert_group(self, group_id: str, company_id: str, name: str):
        if self._exists("Groups", "Id", group_id):
            return
        self._execute(
            "INSERT INTO Groups (Id, CompanyId, Name) VALUES (?, ?, ?)",
            (group_id, company_id, name)
        )
        self._inc("groups")

    def insert_sector_group(self, sector_id: str, group_id: str):
        self.cursor.execute(
            "SELECT COUNT(1) FROM SectorGroups WHERE SectorId = ? AND GroupId = ?",
            (sector_id, group_id)
        )
        if self.cursor.fetchone()[0] > 0:
            return
        self._execute(
            "INSERT INTO SectorGroups (SectorId, GroupId) VALUES (?, ?)",
            (sector_id, group_id)
        )
        self._inc("sector_groups")

    # ---- Identity Users + Profile Users ----

    def insert_identity_user(self, user_id: str, matricula: str, name: str):
        """Cria usuário no AspNetUsers (Identity)."""
        if self._exists("AspNetUsers", "Id", user_id):
            return

        email = f"{matricula}@frotacontrol.com"
        normalized_email = email.upper()
        normalized_name = matricula.upper()
        security_stamp = _new_guid()
        concurrency_stamp = _new_guid()
        password_hash = hash_password_v3(DEFAULT_PASSWORD)

        self._execute(
            """INSERT INTO AspNetUsers
               (Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed,
                PasswordHash, SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed,
                TwoFactorEnabled, LockoutEnabled, AccessFailedCount)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0, 0, 1, 0)""",
            (user_id, matricula, normalized_name, email, normalized_email,
             password_hash, security_stamp, concurrency_stamp)
        )
        self._inc("identity_users")

    def insert_user_profile(self, user_id: str, company_id: str, sector_id: str,
                            name: str, matricula: str, shift: int,
                            is_admin: bool, is_truck: bool, is_op: bool,
                            photo_url: str | None, email: str | None,
                            permitidos: str | None):
        """Cria perfil do usuário na tabela Users."""
        if self._exists("Users", "Id", user_id):
            return
        self._execute(
            """INSERT INTO Users (Id, CompanyId, SectorId, Name, Matricula, Shift,
               IsAdmin, IsTruck, IsOP, PhotoURL, Email, Permitidos)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, company_id, sector_id, name, matricula, shift,
             1 if is_admin else 0, 1 if is_truck else 0, 1 if is_op else 0,
             photo_url, email, permitidos)
        )
        self._inc("user_profiles")

    # ---- Vehicles ----

    def insert_vehicle(self, vehicle_id: str, company_id: str, sector_id: str,
                       model: str, is_truck: bool, status: int):
        if self._exists("Vehicles", "Id", vehicle_id):
            return
        self._execute(
            """INSERT INTO Vehicles (Id, CompanyId, SectorId, Model, IsTruck, Status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (vehicle_id, company_id, sector_id, model, 1 if is_truck else 0, status)
        )
        self._inc("vehicles")

    # ---- Maintenance Records ----

    def insert_maintenance(self, record_id: str, vehicle_id: str,
                           start_time: datetime, end_time: datetime | None, notes: str | None):
        if self._exists("MaintenanceRecords", "Id", record_id):
            return
        self._execute(
            """INSERT INTO MaintenanceRecords (Id, VehicleId, StartTime, EndTime, Notes)
               VALUES (?, ?, ?, ?, ?)""",
            (record_id, vehicle_id, start_time.isoformat() if start_time else None,
             end_time.isoformat() if end_time else None, notes)
        )
        self._inc("maintenance")

    # ---- Checklists ----

    def insert_checklist(self, checklist_id: str, vehicle_id: str, driver_id: str,
                         driver_name: str, timestamp: datetime,
                         company_id: str, sector_id: str):
        if self._exists("Checklists", "Id", checklist_id):
            return
        self._execute(
            """INSERT INTO Checklists (Id, VehicleId, DriverId, DriverName, Timestamp,
               CompanyId, SectorId)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (checklist_id, vehicle_id, driver_id, driver_name,
             timestamp.isoformat() if timestamp else None,
             company_id, sector_id)
        )
        self._inc("checklists")

    def insert_checklist_item(self, checklist_id: str, item_id: str, location: str,
                              title: str, description: str, status: int,
                              observation: str | None, images_json: str | None):
        self.cursor.execute(
            "SELECT COUNT(1) FROM ChecklistItems WHERE ChecklistId = ? AND ItemId = ?",
            (checklist_id, item_id)
        )
        if self.cursor.fetchone()[0] > 0:
            return
        self._execute(
            """INSERT INTO ChecklistItems (ChecklistId, ItemId, Location, Title,
               Description, Status, Observation, Images)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (checklist_id, item_id, location, title, description, status,
             observation, images_json)
        )
        self._inc("checklist_items")

    # ---- Routes ----

    def insert_route(self, route_id: str, company_id: str, sector_id: str,
                     vehicle_id: str, date: str, shift: int, is_fixed: bool):
        if self._exists("Routes", "Id", route_id):
            return
        self._execute(
            """INSERT INTO Routes (Id, CompanyId, SectorId, VehicleId, Date, Shift, IsFixed)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (route_id, company_id, sector_id, vehicle_id, date, shift, 1 if is_fixed else 0)
        )
        self._inc("routes")

    def insert_route_trip(self, trip_id: str, route_id: str, name: str, sort_order: int):
        if self._exists("RouteTrips", "Id", trip_id):
            return
        self._execute(
            "INSERT INTO RouteTrips (Id, RouteId, Name, SortOrder) VALUES (?, ?, ?, ?)",
            (trip_id, route_id, name, sort_order)
        )
        self._inc("route_trips")

    def insert_route_trip_stop(self, trip_id: str, sort_order: int, name: str,
                               planned_arrival: str, planned_departure: str):
        if self._exists("RouteTripStops", "TripId", trip_id):
            self.cursor.execute(
                "SELECT COUNT(1) FROM RouteTripStops WHERE TripId = ? AND SortOrder = ?",
                (trip_id, sort_order)
            )
            if self.cursor.fetchone()[0] > 0:
                return
        self._execute(
            """INSERT INTO RouteTripStops (TripId, SortOrder, Name, PlannedArrival, PlannedDeparture)
               VALUES (?, ?, ?, ?, ?)""",
            (trip_id, sort_order, name, planned_arrival, planned_departure)
        )
        self._inc("route_trip_stops")

    # ---- Runs ----

    def insert_run(self, run_id: str, driver_id: str, driver_name: str,
                   vehicle_id: str, route_id: str | None, trip_id: str | None,
                   trip_name: str | None, shift: int, start_mileage: float,
                   start_time: datetime, end_time: datetime | None,
                   end_mileage: float | None, status: int):
        if self._exists("Runs", "Id", run_id):
            return
        self._execute(
            """INSERT INTO Runs (Id, DriverId, DriverName, VehicleId, RouteId, TripId,
               TripName, Shift, StartMileage, StartTime, EndTime, EndMileage, Status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, driver_id, driver_name, vehicle_id, route_id, trip_id,
             trip_name, shift, start_mileage,
             start_time.isoformat() if start_time else None,
             end_time.isoformat() if end_time else None,
             end_mileage, status)
        )
        self._inc("runs")

    def insert_run_stop(self, run_id: str, sort_order: int, name: str,
                        status: int, planned_arrival: str | None,
                        planned_departure: str | None,
                        arrival_time: datetime | None,
                        departure_time: datetime | None,
                        collected_occupied: int | None,
                        collected_empty: int | None,
                        mileage_at_stop: float | None,
                        occupancy: int | None,
                        observation: str | None):
        self.cursor.execute(
            "SELECT COUNT(1) FROM RunStops WHERE RunId = ? AND SortOrder = ?",
            (run_id, sort_order)
        )
        if self.cursor.fetchone()[0] > 0:
            return
        self._execute(
            """INSERT INTO RunStops (RunId, SortOrder, Name, Status, PlannedArrival,
               PlannedDeparture, ArrivalTime, DepartureTime, CollectedOccupiedCars,
               CollectedEmptyCars, MileageAtStop, Occupancy, Observation)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, sort_order, name, status, planned_arrival, planned_departure,
             arrival_time.isoformat() if arrival_time else None,
             departure_time.isoformat() if departure_time else None,
             collected_occupied, collected_empty, mileage_at_stop,
             occupancy, observation)
        )
        self._inc("run_stops")

    def insert_location_point(self, run_id: str, latitude: float, longitude: float,
                              timestamp: datetime):
        ts_str = timestamp.isoformat() if timestamp else None
        self.cursor.execute(
            "SELECT COUNT(1) FROM LocationPoints WHERE RunId = ? AND Latitude = ? AND Longitude = ? AND Timestamp = ?",
            (run_id, latitude, longitude, ts_str)
        )
        if self.cursor.fetchone()[0] > 0:
            return
        self._execute(
            """INSERT INTO LocationPoints (RunId, Latitude, Longitude, Timestamp)
               VALUES (?, ?, ?, ?)""",
            (run_id, latitude, longitude, ts_str)
        )
        self._inc("location_points")

    # ---- Refuels ----

    def insert_refuel(self, refuel_id: str, company_id: str, sector_id: str,
                      vehicle_id: str, driver_id: str, driver_name: str,
                      liters: float, amount: float, timestamp: datetime):
        if self._exists("Refuels", "Id", refuel_id):
            return
        self._execute(
            """INSERT INTO Refuels (Id, CompanyId, SectorId, VehicleId, DriverId,
               DriverName, Liters, Amount, Timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (refuel_id, company_id, sector_id, vehicle_id, driver_id, driver_name,
             liters, amount, timestamp.isoformat() if timestamp else None)
        )
        self._inc("refuels")

    # ---- Managers ----

    def insert_manager(self, manager_id: str, company_id: str, sector_id: str,
                       name: str, email: str):
        if self._exists("Managers", "Id", manager_id):
            return
        self._execute(
            """INSERT INTO Managers (Id, CompanyId, SectorId, Name, Email)
               VALUES (?, ?, ?, ?, ?)""",
            (manager_id, company_id, sector_id, name, email)
        )
        self._inc("managers")

    # ---- Fuel Cards (RTDB legacy) ----

    def insert_fuel_card(self, vehicle_id: str, company_id: str, sector_id: str,
                         balance: float):
        if self._exists("FuelCards", "VehicleId", vehicle_id):
            return
        self._execute(
            """INSERT INTO FuelCards (VehicleId, CompanyId, SectorId, Balance)
               VALUES (?, ?, ?, ?)""",
            (vehicle_id, company_id, sector_id, balance)
        )
        self._inc("fuel_cards")

    def insert_fuel_card_recharge(self, recharge_id: str, fuel_card_vehicle_id: str,
                                  amount: float, date: str, time: str, responsible: str):
        if self._exists("FuelCardRecharges", "Id", recharge_id):
            return
        self._execute(
            """INSERT INTO FuelCardRecharges (Id, FuelCardVehicleId, Amount, Date, Time, Responsible)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (recharge_id, fuel_card_vehicle_id, amount, date, time, responsible)
        )
        self._inc("fuel_card_recharges")

    # ---- Contadores ----

    def _inc(self, key: str):
        self.counts[key] = self.counts.get(key, 0) + 1

    def print_stats(self):
        print("\n  Registros inseridos:")
        for key, count in sorted(self.counts.items()):
            print(f"    {key}: {count}")


def _new_guid() -> str:
    import uuid
    return str(uuid.uuid4())
