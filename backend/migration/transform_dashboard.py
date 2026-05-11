"""Transforma dashboard/page.tsx de Firebase para API .NET."""
import re

with open(r"C:\workspace\backups\truckcontrol\src\app\dashboard\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace useFirebase() → useAuth()
# Pattern: const { firestore } = useFirebase();
content = content.replace(
    "const { firestore } = useFirebase();",
    "const auth = useAuth();"
)

# 2. Replace firestore dependency in useEffects
content = content.replace("!firestore || ", "!auth.profile || ")

# 3. Replace firestore in other conditions (remaining)
content = content.replace("!firestore || !user ||", "!auth.profile || !user ||")

# 4. Replace localStorage user reads
# Pattern: const storedUser = localStorage.getItem('user');
#           const companyId = localStorage.getItem('companyId');
#           ...
#           if (storedUser && companyId ...) setUser({...JSON.parse(storedUser) ...})
content = re.sub(
    r"const storedUser = localStorage\.getItem\('user'\);\s*const companyId = localStorage\.getItem\('companyId'\);\s*const sectorId = localStorage\.getItem\('sectorId'\);\s*const matricula = localStorage\.getItem\('matricula'\);\s*if \(storedUser && companyId && sectorId && matricula\) setUser\(\{ \.\.\.JSON\.parse\(storedUser\), companyId, sectorId, matricula \}\);",
    "if (auth.profile) setUser({ name: auth.profile.name, isAdmin: auth.profile.isAdmin, isOP: auth.profile.isOP, companyId: auth.profile.companyId, sectorId: auth.profile.sectorId, matricula: auth.profile.matricula });",
    content
)

# 5. Replace localStorage reads for companyId/sectorId in standalone patterns
content = re.sub(
    r"const companyId = localStorage\.getItem\('companyId'\);",
    "const companyId = auth.profile?.companyId || '';",
    content
)
content = re.sub(
    r"const sectorId = localStorage\.getItem\('sectorId'\);",
    "const sectorId = auth.profile?.sectorId || '';",
    content
)
content = re.sub(
    r"const sn = localStorage\.getItem\('sectorName'\) \|\| '';",
    'const sn = auth.profile?.sectorId || "";',
    content
)

# 6. Replace localStorage sectorName
content = re.sub(
    r"setSectorName\(localStorage\.getItem\('sectorName'\) \|\| ''\);",
    "setSectorName(auth.profile?.sectorId || '');",
    content
)

# 7. Replace collection(firestore, ...) patterns → api path building
# Remove all Firebase function imports - already done earlier in manual edit

# 8. Replace: getDocs(query(collection(firestore, path), where clauses))
# Too complex for regex - leave for manual fixes

# 9. Replace: onSnapshot(collection(firestore, path), callback)
# → polling with setInterval

# 10. Replace firestore var in dependency arrays
content = content.replace(", firestore,", ", auth.profile,")
content = content.replace("[firestore,", "[auth.profile,")
content = content.replace("[firestore]", "[auth.profile]")

# 11. Replace remaining firestore references in conditions
content = content.replace("if (!firestore ||", "if (!auth.profile ||")

# 12. Replace the main DashboardPage localStorage read
content = re.sub(
    r"setSectorName\(localStorage\.getItem\('sectorName'\) \|\| ''\);",
    "if (auth.profile) setSectorName(auth.profile.sectorId);",
    content
)

with open(r"C:\workspace\backups\truckcontrol\src\app\dashboard\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Transformations applied. Remaining manual fixes likely needed.")
print("Check for: collection(, onSnapshot, getDocs, getDoc, setDoc, deleteDoc, writeBatch, updateDoc")
