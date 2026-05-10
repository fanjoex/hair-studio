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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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


def send_email_code(to_email: str, code: str) -> bool:
    """
    Send verification code via Gmail SMTP.
    Requires SMTP_EMAIL and SMTP_PASSWORD env vars.
    """
    smtp_email = os.environ.get("SMTP_EMAIL")
    smtp_password = os.environ.get("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        logging.error("SMTP_EMAIL or SMTP_PASSWORD not configured")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔐 Código de verificação: {code}"
        msg["From"] = f"Hair Studio <{smtp_email}>"
        msg["To"] = to_email

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
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_email, smtp_password)
            server.sendmail(smtp_email, to_email, msg.as_string())

        logging.info(f"Verification code sent to {to_email}")
        return True
    except Exception as e:
        logging.error(f"Failed to send email to {to_email}: {e}")
        return False


# ===== ROUTES =====

@admin_settings_router.get("/profile")
async def get_admin_profile(request: Request):
    """Get master admin profile."""
    user = await get_current_admin(request)
    smtp_configured = bool(os.environ.get("SMTP_EMAIL") and os.environ.get("SMTP_PASSWORD"))
    return {
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "has_2fa": smtp_configured,
    }


@admin_settings_router.post("/send-verification-code")
async def send_verification_code(data: SendCodeRequest, request: Request):
    """Send a 6-digit verification code to admin's email."""
    user = await get_current_admin(request)
    from bson import ObjectId

    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email não encontrado no perfil")

    if not os.environ.get("SMTP_EMAIL"):
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
    sent = send_email_code(email, code)
    if not sent:
        raise HTTPException(status_code=500, detail="Falha ao enviar código por email. Verifique a configuração SMTP.")

    # Mask email for response
    parts = email.split("@")
    masked = parts[0][:2] + "****@" + parts[1]
    return {"message": f"Código enviado para {masked}", "expires_in": 300}


@admin_settings_router.put("/profile")
async def update_admin_profile(data: VerifyAndUpdateProfile, request: Request):
    """Update admin profile with 2FA verification."""
    user = await get_current_admin(request)
    from bson import ObjectId

    # If 2FA (SMTP) is configured, require verification code
    if os.environ.get("SMTP_EMAIL"):
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

    # Verify 2FA code (if SMTP configured)
    if os.environ.get("SMTP_EMAIL"):
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
    smtp_configured = bool(os.environ.get("SMTP_EMAIL") and os.environ.get("SMTP_PASSWORD"))
    return {"enabled": smtp_configured, "method": "email" if smtp_configured else None}
