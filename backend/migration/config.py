"""
Configuração da migração Firebase → SQL Server.
Configure as variáveis de ambiente ou edite as constantes abaixo.
"""

import os

# ---- Firebase Firestore (Truck App) ----
FIRESTORE_PROJECT_ID = os.getenv("FIRESTORE_PROJECT_ID", "studio-148161959-37b37")
FIRESTORE_API_KEY = os.getenv("FIRESTORE_API_KEY", "AIzaSyBIG2P0o0OfT11qXwImbErs_Yx8wV4KnkQ")
FIRESTORE_BASE_URL = f"https://firestore.googleapis.com/v1/projects/{FIRESTORE_PROJECT_ID}/databases/(default)/documents"

# ---- Firebase RTDB (Car App - Legacy) ----
RTDB_URL = os.getenv("RTDB_URL", "https://lslcda-default-rtdb.firebaseio.com")

# ---- SQL Server ----
SQL_CONNECTION_STRING = os.getenv("SQL_CONNECTION_STRING", (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost;"
    "Database=FrotacontrolDb;"
    "TrustServerCertificate=Yes;"
    "Trusted_Connection=Yes;"
))

# ---- Migration options ----
DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))

# ---- Password for imported users ----
# Senha temporária para usuários migrados. Eles devem redefinir no primeiro login.
DEFAULT_PASSWORD = os.getenv("DEFAULT_PASSWORD", "Frota@123")
