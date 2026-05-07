"""
Rotas de configurações do administrador master.
Inclui perfil completo e verificação em duas etapas via WhatsApp.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
import random
import logging
import httpx
import os
import urllib.parse

admin_settings_router = APIRouter(prefix="/api/admin")
db = None


def set_admin_settings_db(database):
    global db
    db = database


# ===== MODELS =====

class AdminProfileResponse(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    whatsapp: Optional[str] = None


class AdminProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    verification_code: str


class SendCodeRequest(BaseModel):
    action: str  # "update_profile" or "change_password"


class VerifyAndUpdateProfile(BaseModel):
    verification_code: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None


# ===== HELPERS =====

async def get_current_admin(request: Request) -> dict:
    """Get current user and verify they are master_admin."""
    from server import get_current_user
    user = await get_current_user(request)
    if user.get("role") != "master_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    return user


async def send_whatsapp_code(phone: str, code: str) -> bool:
    """
    Send verification code via WhatsApp using Evolution API or CallMeBot.
    Configure WHATSAPP_API_URL and WHATSAPP_API_KEY in environment.
    """
    # Try Evolution API first
    evolution_url = os.environ.get("EVOLUTION_API_URL")
    evolution_key = os.environ.get("EVOLUTION_API_KEY")
    evolution_instance = os.environ.get("EVOLUTION_INSTANCE", "default")

    if evolution_url and evolution_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{evolution_url}/message/sendText/{evolution_instance}",
                    headers={"apikey": evolution_key, "Content-Type": "application/json"},
                    json={
                        "number": phone,
                        "text": f"🔐 Seu código de verificação é: *{code}*\n\nVálido por 5 minutos.\nNão compartilhe este código."
                    }
                )
                if resp.status_code == 200 or resp.status_code == 201:
                    return True
                logging.warning(f"Evolution API error: {resp.status_code} - {resp.text}")
        except Exception as e:
            logging.warning(f"Evolution API failed: {e}")

    # Fallback: CallMeBot (free, requires prior activation)
    callmebot_key = os.environ.get("CALLMEBOT_API_KEY")
    if callmebot_key:
        try:
            message = urllib.parse.quote(f"🔐 Código de verificação: {code} (válido por 5 min)")
            url = f"https://api.callmebot.com/whatsapp.php?phone={phone}&text={message}&apikey={callmebot_key}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return True
                logging.warning(f"CallMeBot error: {resp.status_code}")
        except Exception as e:
            logging.warning(f"CallMeBot failed: {e}")

    logging.error(f"No WhatsApp provider configured or all failed for {phone}")
    return False


# ===== ROUTES =====

@admin_settings_router.get("/profile")
async def get_admin_profile(request: Request):
    """Get master admin profile."""
    user = await get_current_admin(request)
    return {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "whatsapp": user.get("whatsapp", ""),
        "has_whatsapp_2fa": bool(user.get("whatsapp")),
    }


@admin_settings_router.post("/send-verification-code")
async def send_verification_code(data: SendCodeRequest, request: Request):
    """Send a 6-digit verification code to admin's WhatsApp."""
    user = await get_current_admin(request)

    whatsapp = user.get("whatsapp")
    if not whatsapp:
        raise HTTPException(
            status_code=400,
            detail="Nenhum WhatsApp cadastrado. Atualize seu perfil primeiro com um número de WhatsApp."
        )

    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    # Store code in database
    from bson import ObjectId
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "verification_code": code,
            "verification_code_expires": expires_at.isoformat(),
            "verification_action": data.action,
        }}
    )

    # Send via WhatsApp
    sent = await send_whatsapp_code(whatsapp, code)
    if not sent:
        raise HTTPException(status_code=500, detail="Falha ao enviar código via WhatsApp. Verifique a configuração.")

    # Mask phone for response
    masked = whatsapp[:4] + "****" + whatsapp[-2:]
    return {"message": f"Código enviado para {masked}", "expires_in": 300}


@admin_settings_router.put("/profile")
async def update_admin_profile(data: VerifyAndUpdateProfile, request: Request):
    """Update admin profile with 2FA verification."""
    user = await get_current_admin(request)
    from bson import ObjectId

    # If admin has WhatsApp configured, require verification code
    if user.get("whatsapp"):
        stored_code = user.get("verification_code")
        expires_str = user.get("verification_code_expires")

        if not stored_code or not data.verification_code:
            raise HTTPException(status_code=400, detail="Código de verificação necessário")

        if data.verification_code != stored_code:
            raise HTTPException(status_code=400, detail="Código de verificação inválido")

        if expires_str:
            expires = datetime.fromisoformat(expires_str)
            if datetime.now(timezone.utc) > expires:
                raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo.")

    # Build update
    update = {}
    if data.name is not None:
        update["name"] = data.name
    if data.email is not None:
        # Check if email already exists
        existing = await db.users.find_one({"email": data.email, "_id": {"$ne": ObjectId(user["_id"])}})
        if existing:
            raise HTTPException(status_code=400, detail="Este email já está em uso")
        update["email"] = data.email
    if data.phone is not None:
        update["phone"] = data.phone
    if data.whatsapp is not None:
        update["whatsapp"] = data.whatsapp

    if not update:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")

    # Clear verification code after successful use
    update["verification_code"] = None
    update["verification_code_expires"] = None

    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": update})
    return {"message": "Perfil atualizado com sucesso"}


@admin_settings_router.put("/change-password")
async def change_admin_password(data: PasswordChange, request: Request):
    """Change admin password with 2FA verification."""
    user = await get_current_admin(request)
    from bson import ObjectId
    from server import verify_password, hash_password

    # Verify current password
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not verify_password(data.current_password, full_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")

    # Verify 2FA code (if WhatsApp configured)
    if user.get("whatsapp"):
        stored_code = full_user.get("verification_code")
        expires_str = full_user.get("verification_code_expires")

        if not stored_code or not data.verification_code:
            raise HTTPException(status_code=400, detail="Código de verificação necessário")

        if data.verification_code != stored_code:
            raise HTTPException(status_code=400, detail="Código de verificação inválido")

        if expires_str:
            expires = datetime.fromisoformat(expires_str)
            if datetime.now(timezone.utc) > expires:
                raise HTTPException(status_code=400, detail="Código expirado. Solicite um novo.")

    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 6 caracteres")

    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "password_hash": new_hash,
            "verification_code": None,
            "verification_code_expires": None,
        }}
    )
    return {"message": "Senha alterada com sucesso"}


@admin_settings_router.post("/setup-whatsapp")
async def setup_whatsapp(request: Request):
    """
    First-time WhatsApp setup. Allows setting WhatsApp number without 2FA
    (since 2FA is not yet configured). After this, all changes require 2FA.
    """
    user = await get_current_admin(request)
    from bson import ObjectId

    # Only allow if WhatsApp is not yet configured
    if user.get("whatsapp"):
        raise HTTPException(status_code=400, detail="WhatsApp já configurado. Use verificação para alterar.")

    body = await request.json()
    whatsapp = body.get("whatsapp", "").strip()

    if not whatsapp or len(whatsapp) < 10:
        raise HTTPException(status_code=400, detail="Número de WhatsApp inválido")

    # Send a test code to verify the number works
    code = str(random.randint(100000, 999999))
    sent = await send_whatsapp_code(whatsapp, code)

    if not sent:
        raise HTTPException(status_code=500, detail="Não foi possível enviar código para este número. Verifique a configuração do WhatsApp API.")

    # Store pending verification
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "pending_whatsapp": whatsapp,
            "verification_code": code,
            "verification_code_expires": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        }}
    )
    return {"message": "Código enviado! Confirme para ativar a verificação em duas etapas."}


@admin_settings_router.post("/confirm-whatsapp")
async def confirm_whatsapp(request: Request):
    """Confirm WhatsApp number with the code sent during setup."""
    user = await get_current_admin(request)
    from bson import ObjectId

    body = await request.json()
    code = body.get("code", "").strip()

    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    stored_code = full_user.get("verification_code")
    expires_str = full_user.get("verification_code_expires")
    pending = full_user.get("pending_whatsapp")

    if not stored_code or code != stored_code:
        raise HTTPException(status_code=400, detail="Código inválido")

    if expires_str:
        expires = datetime.fromisoformat(expires_str)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Código expirado")

    if not pending:
        raise HTTPException(status_code=400, detail="Nenhum número pendente")

    # Activate WhatsApp 2FA
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "whatsapp": pending,
            "verification_code": None,
            "verification_code_expires": None,
            "pending_whatsapp": None,
        }}
    )
    return {"message": "WhatsApp confirmado! Verificação em duas etapas ativada."}
