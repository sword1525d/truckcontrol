"""Atualiza hashes de senha inválidos (MIGRATED_PLACEHOLDER) para hashes reais."""
import pyodbc
import hashlib
import base64
import os

def hash_password_v3(password: str) -> str:
    salt = os.urandom(16)
    iterations = 100_000
    subkey = hashlib.pbkdf2_hmac("sha512", password.encode("utf-8"), salt, iterations, dklen=32)
    # .NET 10 format: [0x01][PRF BE4][iter BE4][saltLen BE4][salt 16B][subkey 32B]
    prf = 2  # KeyDerivationPrf.HMACSHA512
    header = b"\x01" + prf.to_bytes(4, "big") + iterations.to_bytes(4, "big") + (16).to_bytes(4, "big")
    return base64.b64encode(header + salt + subkey).decode("ascii")

conn_str = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost;"
    "Database=Frotacontrol;"
    "TrustServerCertificate=Yes;"
    "Trusted_Connection=Yes;"
)
PASSWORD = "Frota@123"

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

# Lista usuários com hash placeholder
cursor.execute("SELECT Id, UserName FROM AspNetUsers")
users = cursor.fetchall()
print(f"Encontrados {len(users)} usuarios com hash invalido.")

for user_id, username in users:
    new_hash = hash_password_v3(PASSWORD)
    cursor.execute("UPDATE AspNetUsers SET PasswordHash = ? WHERE Id = ?", (new_hash, user_id))
    print(f"  Atualizado: {username}")

conn.commit()
conn.close()
print("Pronto!")
