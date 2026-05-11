"""
Rotas de pagamento via Pix.
Suporta Mercado Pago e PagSeguro.
Barbeiro cria cobrança no painel e envia QR code para o totem.
"""

import uuid
import logging
import httpx
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List

payment_router = APIRouter(prefix="/api/payment")
db = None


def set_payment_db(database):
    global db
    db = database


# ===== MODELS =====

class ChargeItem(BaseModel):
    service_id: Optional[str] = None
    name: str
    price: float


class CreateChargeRequest(BaseModel):
    items: List[ChargeItem]
    custom_amount: Optional[float] = None  # valor avulso/desconto
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None


class GatewayConfig(BaseModel):
    gateway: str  # "mercadopago" | "pagseguro" | "pix_manual"
    access_token: Optional[str] = None   # Mercado Pago
    client_id: Optional[str] = None      # PagSeguro
    client_secret: Optional[str] = None  # PagSeguro
    pix_key: Optional[str] = None        # chave pix manual


# ===== HELPERS =====

async def require_barbershop(request: Request):
    from server import get_current_user
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("barbershop_owner", "barbershop_staff", "master_admin", "admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    barbershop_id = user.get("barbershop_id")
    if not barbershop_id and role != "master_admin":
        raise HTTPException(status_code=400, detail="Barbearia não encontrada")
    return user, barbershop_id


async def get_gateway_config(barbershop_id: str) -> dict:
    config = await db.payment_config.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
    return config or {}


async def create_mp_charge(total: float, description: str, config: dict) -> dict:
    """Cria cobrança Pix via Mercado Pago."""
    token = config.get("access_token")
    if not token:
        raise HTTPException(status_code=400, detail="Token do Mercado Pago não configurado")

    idempotency = str(uuid.uuid4())
    payload = {
        "transaction_amount": round(total, 2),
        "description": description,
        "payment_method_id": "pix",
        "payer": {"email": "cliente@barbearia.com"},
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.mercadopago.com/v1/payments",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Idempotency-Key": idempotency,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        data = resp.json()
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=400, detail=f"Mercado Pago: {data.get('message', str(data))}")

        pix_data = data.get("point_of_interaction", {}).get("transaction_data", {})
        return {
            "gateway": "mercadopago",
            "external_id": str(data["id"]),
            "qr_code": pix_data.get("qr_code", ""),
            "qr_code_base64": pix_data.get("qr_code_base64", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"MP charge error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro Mercado Pago: {e}")


async def create_ps_charge(total: float, description: str, config: dict) -> dict:
    """Cria cobrança Pix via PagSeguro."""
    client_id = config.get("client_id")
    client_secret = config.get("client_secret")
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Credenciais do PagSeguro não configuradas")

    try:
        # Get OAuth token
        async with httpx.AsyncClient(timeout=20) as client:
            auth_resp = await client.post(
                "https://oauth2.sandbox.pagseguro.uol.com.br/oauth2/token",
                data={"grant_type": "client_credentials"},
                auth=(client_id, client_secret),
            )
        if auth_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="PagSeguro: falha na autenticação")
        ps_token = auth_resp.json().get("access_token")

        ref_id = str(uuid.uuid4())
        payload = {
            "reference_id": ref_id,
            "description": description,
            "amount": {"value": int(round(total * 100)), "currency": "BRL"},
            "payment_method": {"type": "PIX", "installments": 1},
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.sandbox.pagseguro.com/orders",
                headers={"Authorization": f"Bearer {ps_token}", "Content-Type": "application/json"},
                json=payload,
            )
        data = resp.json()
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=400, detail=f"PagSeguro: {data}")

        pix = data.get("qr_codes", [{}])[0]
        return {
            "gateway": "pagseguro",
            "external_id": data.get("id", ref_id),
            "qr_code": pix.get("text", ""),
            "qr_code_base64": "",
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"PagSeguro charge error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro PagSeguro: {e}")


def create_pix_manual(total: float, description: str, config: dict) -> dict:
    """Gera payload Pix estático EMV válido conforme spec Banco Central."""
    pix_key = config.get("pix_key", "").strip()
    if not pix_key:
        raise HTTPException(status_code=400, detail="Chave Pix não configurada. Configure em Pagamentos → Configurações.")

    def _field(id_: str, value: str) -> str:
        return f"{id_}{len(value):02d}{value}"

    def crc16_ccitt(data: str) -> str:
        crc = 0xFFFF
        for byte in data.encode("utf-8"):
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc <<= 1
                crc &= 0xFFFF
        return format(crc, "04X")

    # ID 26 — Merchant Account Info (Pix)
    gui = _field("00", "BR.GOV.BCB.PIX")
    key = _field("01", pix_key)
    # Truncate description to 25 chars, only ASCII letters/digits/spaces
    import unicodedata
    desc_norm = unicodedata.normalize("NFD", description)
    desc_ascii = "".join(c for c in desc_norm if unicodedata.category(c) != "Mn")
    desc_clean = "".join(c for c in desc_ascii if c.isascii() and (c.isalnum() or c == " "))[:25].strip()
    info_add = _field("02", desc_clean) if desc_clean else ""
    merchant_account = _field("26", gui + key + info_add)

    # ID 62 — Additional Data (txid = ***)
    txid_field = _field("05", "***")
    additional = _field("62", txid_field)

    amount_str = f"{total:.2f}"

    payload_no_crc = (
        _field("00", "01")           # Payload format indicator
        + _field("01", "12")         # Point of initiation: 12=static, 11=dynamic
        + merchant_account
        + _field("52", "0000")       # Merchant category code
        + _field("53", "986")        # Currency BRL
        + _field("54", amount_str)   # Amount
        + _field("58", "BR")         # Country
        + _field("59", "Barbearia")  # Merchant name (max 25 chars)
        + _field("60", "BELO HORIZONTE")  # Merchant city (max 15 chars)
        + additional
        + "6304"                     # CRC placeholder
    )

    crc = crc16_ccitt(payload_no_crc)
    qr_code = payload_no_crc + crc

    return {
        "gateway": "pix_manual",
        "external_id": str(uuid.uuid4()),
        "qr_code": qr_code,
        "qr_code_base64": "",
    }


async def check_mp_status(external_id: str, config: dict) -> str:
    token = config.get("access_token", "")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.mercadopago.com/v1/payments/{external_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
        data = resp.json()
        status = data.get("status", "")
        if status == "approved":
            return "paid"
        elif status in ("cancelled", "rejected"):
            return "cancelled"
        return "pending"
    except Exception:
        return "pending"


# ===== ROUTES =====

@payment_router.get("/clients/search")
async def search_clients_for_payment(q: str = "", request: Request = None):
    """Busca clientes da barbearia para associar a cobrança."""
    _, barbershop_id = await require_barbershop(request)
    query = {"barbershop_id": barbershop_id}
    if q:
        import re
        query["$or"] = [
            {"name": {"$regex": re.escape(q), "$options": "i"}},
            {"phone": {"$regex": re.escape(q), "$options": "i"}},
        ]
    clients = await db.clients.find(query, {"_id": 0, "id": 1, "name": 1, "phone": 1}).to_list(20)
    return clients


@payment_router.get("/client/{client_id}/history")
async def get_client_payment_history(client_id: str, request: Request):
    """Histórico de pagamentos de um cliente."""
    _, barbershop_id = await require_barbershop(request)
    charges = await db.charges.find(
        {"barbershop_id": barbershop_id, "client_id": client_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    total_paid = sum(c["total"] for c in charges if c.get("status") == "paid")
    return {"charges": charges, "total_paid": round(total_paid, 2)}


@payment_router.get("/config")
async def get_payment_config(request: Request):
    """Buscar configuração de gateway da barbearia."""
    _, barbershop_id = await require_barbershop(request)
    config = await get_gateway_config(barbershop_id)
    # Retorna config sem expor tokens completos
    return {
        "gateway": config.get("gateway", "pix_manual"),
        "pix_key": config.get("pix_key", ""),
        "has_mp_token": bool(config.get("access_token")),
        "has_ps_credentials": bool(config.get("client_id") and config.get("client_secret")),
    }


@payment_router.put("/config")
async def save_payment_config(data: GatewayConfig, request: Request):
    """Salvar configuração de gateway da barbearia."""
    _, barbershop_id = await require_barbershop(request)
    doc = {
        "barbershop_id": barbershop_id,
        "gateway": data.gateway,
        "pix_key": data.pix_key or "",
        "access_token": data.access_token or "",
        "client_id": data.client_id or "",
        "client_secret": data.client_secret or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_config.update_one(
        {"barbershop_id": barbershop_id},
        {"$set": doc},
        upsert=True,
    )
    return {"message": "Configuração salva"}


@payment_router.post("/charge")
async def create_charge(data: CreateChargeRequest, request: Request):
    """Criar cobrança Pix e retornar QR code para o totem."""
    _, barbershop_id = await require_barbershop(request)

    # Calcular total
    total = sum(item.price for item in data.items)
    if data.custom_amount is not None:
        total = data.custom_amount  # substitui pelo valor ajustado

    if total <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    description = data.description or ", ".join(i.name for i in data.items)

    config = await get_gateway_config(barbershop_id)
    gateway = config.get("gateway", "pix_manual")

    if gateway == "mercadopago":
        gw_data = await create_mp_charge(total, description, config)
    elif gateway == "pagseguro":
        gw_data = await create_ps_charge(total, description, config)
    else:
        gw_data = create_pix_manual(total, description, config)

    # Resolve client name from DB if client_id provided
    resolved_client_name = data.client_name or ""
    if data.client_id:
        client_doc = await db.clients.find_one({"id": data.client_id, "barbershop_id": barbershop_id}, {"_id": 0})
        if client_doc:
            resolved_client_name = client_doc.get("name", resolved_client_name)

    # Salvar cobrança no banco
    charge_id = str(uuid.uuid4())
    charge = {
        "id": charge_id,
        "barbershop_id": barbershop_id,
        "items": [i.model_dump() for i in data.items],
        "total": round(total, 2),
        "description": description,
        "client_id": data.client_id or "",
        "client_name": resolved_client_name,
        "gateway": gw_data["gateway"],
        "external_id": gw_data["external_id"],
        "qr_code": gw_data["qr_code"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    }
    await db.charges.insert_one(charge)
    charge.pop("_id", None)

    return {
        "charge_id": charge_id,
        "total": charge["total"],
        "description": description,
        "qr_code": gw_data["qr_code"],
        "qr_code_base64": gw_data.get("qr_code_base64", ""),
        "gateway": gw_data["gateway"],
        "status": "pending",
        "expires_at": charge["expires_at"],
    }


@payment_router.get("/charge/{charge_id}")
async def get_charge(charge_id: str, request: Request):
    """Buscar status de cobrança (polling do totem)."""
    from server import get_current_user
    # Permite acesso público (totem) ou autenticado
    charge = await db.charges.find_one({"id": charge_id}, {"_id": 0})
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    # Se pendente e gateway MP, consulta status externo
    if charge["status"] == "pending" and charge["gateway"] == "mercadopago":
        config = await get_gateway_config(charge["barbershop_id"])
        status = await check_mp_status(charge["external_id"], config)
        if status != "pending":
            await db.charges.update_one(
                {"id": charge_id},
                {"$set": {"status": status, "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
            charge["status"] = status

    return {
        "charge_id": charge["id"],
        "total": charge["total"],
        "description": charge["description"],
        "status": charge["status"],
        "qr_code": charge["qr_code"],
        "gateway": charge["gateway"],
        "expires_at": charge["expires_at"],
    }


@payment_router.post("/charge/{charge_id}/confirm")
async def confirm_charge(charge_id: str, request: Request):
    """Confirmação manual de pagamento (pix_manual ou pagseguro)."""
    _, barbershop_id = await require_barbershop(request)
    charge = await db.charges.find_one({"id": charge_id, "barbershop_id": barbershop_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    await db.charges.update_one(
        {"id": charge_id},
        {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Pagamento confirmado"}


@payment_router.post("/charge/{charge_id}/cancel")
async def cancel_charge(charge_id: str, request: Request):
    """Cancelar cobrança."""
    _, barbershop_id = await require_barbershop(request)
    await db.charges.update_one(
        {"id": charge_id, "barbershop_id": barbershop_id},
        {"$set": {"status": "cancelled"}}
    )
    return {"message": "Cobrança cancelada"}


@payment_router.get("/charges")
async def list_charges(request: Request):
    """Listar cobranças da barbearia."""
    _, barbershop_id = await require_barbershop(request)
    charges = await db.charges.find(
        {"barbershop_id": barbershop_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return charges


@payment_router.post("/charge/{charge_id}/send-to-totem")
async def send_to_totem(charge_id: str, request: Request):
    """Envia cobrança para ser exibida no totem."""
    _, barbershop_id = await require_barbershop(request)
    charge = await db.charges.find_one({"id": charge_id, "barbershop_id": barbershop_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")
    await db.totem_charge.update_one(
        {"barbershop_id": barbershop_id},
        {"$set": {"barbershop_id": barbershop_id, "charge_id": charge_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"message": "Cobrança enviada ao totem"}


@payment_router.delete("/totem-charge")
async def clear_totem_charge(request: Request):
    """Limpa cobrança do totem (após pagamento ou cancelamento)."""
    _, barbershop_id = await require_barbershop(request)
    await db.totem_charge.delete_one({"barbershop_id": barbershop_id})
    return {"message": "Totem limpo"}


@payment_router.get("/public/totem-charge/{barbershop_id}")
async def get_totem_charge(barbershop_id: str):
    """Totem verifica se há cobrança ativa para exibir."""
    totem = await db.totem_charge.find_one({"barbershop_id": barbershop_id}, {"_id": 0})
    if not totem:
        return {"charge": None}
    charge = await db.charges.find_one({"id": totem["charge_id"]}, {"_id": 0})
    if not charge or charge["status"] != "pending":
        await db.totem_charge.delete_one({"barbershop_id": barbershop_id})
        return {"charge": None}

    if charge["gateway"] == "mercadopago":
        config = await get_gateway_config(barbershop_id)
        status = await check_mp_status(charge["external_id"], config)
        if status != "pending":
            await db.charges.update_one({"id": charge["id"]}, {"$set": {"status": status}})
            await db.totem_charge.delete_one({"barbershop_id": barbershop_id})
            return {"charge": None}

    return {"charge": {
        "charge_id": charge["id"],
        "total": charge["total"],
        "description": charge["description"],
        "qr_code": charge["qr_code"],
        "status": charge["status"],
        "gateway": charge["gateway"],
    }}


@payment_router.get("/public/charge/{charge_id}")
async def get_public_charge(charge_id: str):
    """Endpoint público para o totem verificar status sem autenticação."""
    charge = await db.charges.find_one({"id": charge_id}, {"_id": 0})
    if not charge:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada")

    if charge["status"] == "pending" and charge["gateway"] == "mercadopago":
        config = await get_gateway_config(charge["barbershop_id"])
        status = await check_mp_status(charge["external_id"], config)
        if status != "pending":
            await db.charges.update_one(
                {"id": charge_id},
                {"$set": {"status": status, "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
            charge["status"] = status

    return {
        "charge_id": charge["id"],
        "total": charge["total"],
        "description": charge["description"],
        "status": charge["status"],
        "qr_code": charge["qr_code"],
        "gateway": charge["gateway"],
        "expires_at": charge["expires_at"],
    }
