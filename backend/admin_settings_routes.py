"""
Rotas de configurações do administrador master.
Inclui perfil completo e verificação em duas etapas via Email.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
import random
import logging
import os
import httpx

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


async def send_email_code(to_email: str, code: str) -> None:
    """
    Send verification code via Resend API (HTTPS).
    Requires RESEND_API_KEY env var.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY não configurado no servidor")

    html = f"""
    <div style="font-family:sans-serif;max-width:400px;margin:0 auto;background:#18181b;color:#fff;padding:32px;border-radius:12px;">
      <h2 style="color:#d4af37;margin-bottom:8px;">Verificação em Duas Etapas</h2>
      <p style="color:#a1a1aa;">Use o código abaixo para confirmar sua ação:</p>
      <div style="background:#09090b;border:2px solid #d4af37;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#d4af37;">{code}</span>
      </div>
      <p style="color:#71717a;font-size:13px;">⏱ Válido por 5 minutos. Não compartilhe este código.</p>
      <p style="color:#52525b;font-size:12px;margin-top:16px;">Se não foi você, ignore este email.</p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": "Hair Studio <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": f"🔐 Código de verificação: {code}",
                    "html": html,
                }
            )
        if resp.status_code not in (200, 201):
            logging.error(f"Resend API error {resp.status_code}: {resp.text}")
            raise RuntimeError(f"Erro ao enviar email: {resp.text}")
        logging.info(f"Verification code sent to {to_email}")
    except httpx.RequestError as e:
        logging.error(f"Resend request failed: {e}")
        raise RuntimeError(f"Falha de conexão com Resend: {e}")


# ===== ROUTES =====

@admin_settings_router.get("/profile")
async def get_admin_profile(request: Request):
    """Get master admin profile."""
    user = await get_current_admin(request)
    has_2fa = bool(os.environ.get("RESEND_API_KEY"))
    return {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "has_2fa": has_2fa,
    }


@admin_settings_router.post("/send-verification-code")
async def send_verification_code(data: SendCodeRequest, request: Request):
    """Send a 6-digit verification code to admin's email."""
    user = await get_current_admin(request)
    from bson import ObjectId

    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email não encontrado no perfil")

    if not os.environ.get("RESEND_API_KEY"):
        raise HTTPException(status_code=500, detail="Serviço de email não configurado no servidor")

    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    # Store code in database
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": {
            "verification_code": code,
            "verification_code_expires": expires_at.isoformat(),
            "verification_action": data.action,
        }}
    )

    # Send via Email
    try:
        await send_email_code(email, code)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Mask email for response
    parts = email.split("@")
    masked = parts[0][:2] + "****@" + parts[1]
    return {"message": f"Código enviado para {masked}", "expires_in": 300}


@admin_settings_router.put("/profile")
async def update_admin_profile(data: VerifyAndUpdateProfile, request: Request):
    """Update admin profile with 2FA verification."""
    user = await get_current_admin(request)
    from bson import ObjectId

    # If 2FA (Resend) is configured, require verification code
    if os.environ.get("RESEND_API_KEY"):
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

    # Verify 2FA code (if Resend configured)
    if os.environ.get("RESEND_API_KEY"):
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


@admin_settings_router.get("/2fa-status")
async def get_2fa_status(request: Request):
    """Check if 2FA (email) is configured."""
    await get_current_admin(request)
    has_2fa = bool(os.environ.get("RESEND_API_KEY"))
    return {"enabled": has_2fa, "method": "email" if has_2fa else None}
