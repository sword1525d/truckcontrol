"""Verifica se o hash SHA512 confere com a senha 'Frota@123'."""
import pyodbc
import hashlib
import base64

conn = pyodbc.connect(
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost;"
    "Database=Frotacontrol;"
    "TrustServerCertificate=Yes;"
    "Trusted_Connection=Yes;"
)
cursor = conn.cursor()
cursor.execute("SELECT PasswordHash FROM AspNetUsers WHERE UserName = '801231'")
row = cursor.fetchone()
hash_b64 = row[0]
print(f"Hash: {hash_b64[:60]}...")

raw = base64.b64decode(hash_b64)
print(f"Raw bytes: {len(raw)}")
print(f"Format byte: {raw[0]}")
iterations = int.from_bytes(raw[1:5], "big")
print(f"Iterations: {iterations}")
salt = raw[5:21]
print(f"Salt: {salt.hex()}")
expected = raw[21:]
print(f"Stored subkey: {expected.hex()}")

# Test SHA512
computed_sha512 = hashlib.pbkdf2_hmac("sha512", "Frota@123".encode("utf-8"), salt, iterations, dklen=32)
print(f"SHA512 computed: {computed_sha512.hex()}")
print(f"SHA512 MATCH: {computed_sha512 == expected}")

# Test SHA256
computed_sha256 = hashlib.pbkdf2_hmac("sha256", "Frota@123".encode("utf-8"), salt, iterations, dklen=32)
print(f"SHA256 computed: {computed_sha256.hex()}")
print(f"SHA256 MATCH: {computed_sha256 == expected}")

conn.close()
