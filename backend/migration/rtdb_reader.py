"""
Leitor de dados do Firebase Realtime Database (RTDB) legado do módulo Carro.
URL base: https://lslcda-default-rtdb.firebaseio.com
"""

import requests
from config import RTDB_URL


def _get(path: str) -> dict:
    """GET em um path do RTDB. Retorna dict ou None."""
    url = f"{RTDB_URL}/{path}.json"
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def read_empresas() -> list[str]:
    """Lê a lista de empresas do RTDB. /empresas → { nome: true, ... }."""
    data = _get("empresas")
    if not data:
        return []
    return list(data.keys())


def read_setores(empresa: str) -> list[str]:
    """Lê SETORES de uma empresa. /{empresa}/SETORES → { nome: true, ... }."""
    data = _get(f"{empresa}/SETORES")
    if not data:
        return []
    return list(data.keys())


def read_grupos(empresa: str) -> dict:
    """Lê grupos. /{empresa}/GRUPOS → { id: { nome: ... }, ... }."""
    return _get(f"{empresa}/GRUPOS") or {}


def read_grupos_setores(empresa: str) -> dict:
    """Lê mapeamento setor→grupo. /{empresa}/GRUPOS_SETORES → { setor: grupoId, ... }."""
    return _get(f"{empresa}/GRUPOS_SETORES") or {}


def read_car_users(empresa: str, setor: str) -> list[dict]:
    """Lê usuários do módulo carro. /{empresa}/{setor}/users/{matricula}."""
    data = _get(f"{empresa}/{setor}/users")
    if not data:
        return []
    return [{"_matricula": mat, **user} for mat, user in data.items()]


def read_car_vehicles(empresa: str, setor: str) -> list[dict]:
    """Lê veículos do módulo carro. /{empresa}/{setor}/veiculos/{nome}."""
    data = _get(f"{empresa}/{setor}/veiculos")
    if not data:
        return []
    return [{"_nome": nome, **veic} for nome, veic in data.items()]


def read_car_fuel_cards(empresa: str, setor: str) -> dict:
    """Lê cartões combustível. /{empresa}/{setor}/cartao/{veiculo}."""
    return _get(f"{empresa}/{setor}/cartao") or {}


def read_car_corridas(empresa: str, setor: str) -> list[dict]:
    """Lê corridas do módulo carro. /{empresa}/{setor}/corridas/{id}."""
    data = _get(f"{empresa}/{setor}/corridas")
    if not data:
        return []
    return [{"_id": cid, **corrida} for cid, corrida in data.items()]
