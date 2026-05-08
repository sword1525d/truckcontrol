"""
Leitor de dados do Firestore via REST API.
Todos os dados estão no projeto 'studio-148161959-37b37'.
"""

import requests
from config import FIRESTORE_BASE_URL
from datetime import datetime, timezone


def _parse_value(field_value: dict):
    """Converte um fieldValue do Firestore REST para valor Python."""
    if "stringValue" in field_value:
        return field_value["stringValue"]
    if "integerValue" in field_value:
        return int(field_value["integerValue"])
    if "doubleValue" in field_value:
        return float(field_value["doubleValue"])
    if "booleanValue" in field_value:
        return field_value["booleanValue"]
    if "nullValue" in field_value:
        return None
    if "timestampValue" in field_value:
        # Retorna datetime com timezone
        ts = field_value["timestampValue"]
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if "arrayValue" in field_value:
        items = field_value["arrayValue"].get("values", [])
        # Pode ser array de strings ou array de maps
        result = []
        for item in items:
            if "mapValue" in item:
                result.append(parse_document(item["mapValue"]))
            elif "stringValue" in item:
                result.append(item["stringValue"])
            else:
                result.append(_parse_value(item))
        return result
    if "mapValue" in field_value:
        return parse_document(field_value["mapValue"])
    return None


def parse_document(fields: dict) -> dict:
    """Converte o map 'fields' do Firestore REST para dict Python."""
    if "fields" not in fields:
        return {}
    result = {}
    for key, value in fields["fields"].items():
        result[key] = _parse_value(value)
    return result


def _get(path: str) -> list[dict]:
    """Executa GET na Firestore REST API e retorna documentos parseados."""
    url = f"{FIRESTORE_BASE_URL}/{path}"
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    data = response.json()

    documents = []
    docs = data.get("documents", [])
    for doc in docs:
        parsed = parse_document(doc)
        # Extrai o ID do documento do path completo
        name = doc.get("name", "")
        doc_id = name.split("/")[-1] if name else None
        if doc_id:
            parsed["_doc_id"] = doc_id
        documents.append(parsed)

    return documents


# ---- Leitores por coleção ----

def read_companies() -> list[dict]:
    """Lê todas as empresas da coleção raiz 'companies'."""
    print("  Lendo companies...")
    return _get("companies")


def read_sectors(company_id: str) -> list[dict]:
    """Lê setores de uma empresa."""
    return _get(f"companies/{company_id}/sectors")


def read_users(company_id: str, sector_id: str) -> list[dict]:
    """Lê usuários de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/users")


def read_vehicles(company_id: str, sector_id: str) -> list[dict]:
    """Lê veículos de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/vehicles")


def read_maintenance(company_id: str, sector_id: str, vehicle_id: str) -> list[dict]:
    """Lê registros de manutenção de um veículo."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/vehicles/{vehicle_id}/maintenance")


def read_checklists(company_id: str, sector_id: str, vehicle_id: str) -> list[dict]:
    """Lê checklists de um veículo."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/vehicles/{vehicle_id}/checklists")


def read_runs(company_id: str, sector_id: str) -> list[dict]:
    """Lê corridas de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/runs")


def read_routes(company_id: str, sector_id: str) -> list[dict]:
    """Lê rotas milkrun de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/routes")


def read_refuels(company_id: str, sector_id: str) -> list[dict]:
    """Lê abastecimentos de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/refuels")


def read_managers(company_id: str, sector_id: str) -> list[dict]:
    """Lê gestores de um setor."""
    return _get(f"companies/{company_id}/sectors/{sector_id}/managers")


def read_settings(company_id: str, sector_id: str) -> dict | None:
    """Lê settings/app de um setor. Retorna None se não existir."""
    try:
        return _get(f"companies/{company_id}/sectors/{sector_id}/settings")[0] if _get(f"companies/{company_id}/sectors/{sector_id}/settings") else None
    except Exception:
        return None
