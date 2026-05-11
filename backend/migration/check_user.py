import pyodbc

conn = pyodbc.connect(
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=localhost;"
    "Database=Frotacontrol;"
    "TrustServerCertificate=Yes;"
    "Trusted_Connection=Yes;"
)
cursor = conn.cursor()

cursor.execute(
    "SELECT Id, UserName, NormalizedUserName, Email, NormalizedEmail, PasswordHash "
    "FROM AspNetUsers WHERE UserName = '801231' OR Email LIKE '%801231%'"
)
for r in cursor.fetchall():
    print(f"AspNetUsers: Id={r[0]}")
    print(f"  UserName={r[1]}")
    print(f"  NormalizedUserName={r[2]}")
    print(f"  Email={r[3]}")
    print(f"  NormalizedEmail={r[4]}")
    print(f"  PasswordHash[0:50]={r[5][:50]}")

cursor.execute(
    "SELECT Id, Matricula, Name, CompanyId, SectorId, IsAdmin, IsTruck, IsOP "
    "FROM Users WHERE Matricula = '801231'"
)
for r in cursor.fetchall():
    print(f"Users: Id={r[0]}, Matricula={r[1]}, Name={r[2]}")
    print(f"  CompanyId={r[3]}, SectorId={r[4]}")
    print(f"  IsAdmin={r[5]}, IsTruck={r[6]}, IsOP={r[7]}")

conn.close()
