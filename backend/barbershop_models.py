"""
Models para o sistema de gerenciamento de barbearias.
Seguindo o padrão Pydantic do projeto existente.
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid


# ===== BARBERSHOP MODELS =====

class Address(BaseModel):
    """Modelo de endereço completo."""
    street: str
    number: str
    complement: Optional[str] = None
    neighborhood: str
    city: str
    state: str
    zip_code: str


class Subscription(BaseModel):
    """Modelo de assinatura da barbearia."""
    plan: str = "free"  # "free", "basic", "premium"
    expires_at: Optional[datetime] = None


class BarbershopSettings(BaseModel):
    """Configurações da barbearia."""
    opening_hours: Optional[Dict[str, str]] = None  # {"monday": "08:00-18:00", ...}
    max_clients: int = 100
    notification_email: Optional[str] = None


class Barbershop(BaseModel):
    """Model principal de Barbearia."""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    document: Optional[str] = None  # CNPJ ou CPF
    phone: str
    email: EmailStr
    address: Address
    owner_id: Optional[str] = None  # ID do usuário dono
    status: str = "pending"  # "active", "inactive", "pending"
    subscription: Subscription = Field(default_factory=Subscription)
    settings: BarbershopSettings = Field(default_factory=BarbershopSettings)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BarbershopCreate(BaseModel):
    """DTO para criação de barbearia."""
    name: str
    document: Optional[str] = None
    phone: str
    email: EmailStr
    address: Address
    owner_email: Optional[EmailStr] = None  # Email do dono (criar usuário automaticamente)


class BarbershopUpdate(BaseModel):
    """DTO para atualização de barbearia."""
    name: Optional[str] = None
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    status: Optional[str] = None
    settings: Optional[BarbershopSettings] = None


class BarbershopResponse(BaseModel):
    """Response model de barbearia."""
    model_config = ConfigDict(extra="ignore")
    
    id: str
    name: str
    document: Optional[str]
    phone: str
    email: str
    address: Address
    status: str
    subscription: Subscription
    created_at: datetime
    
    # Campos calculados
    total_clients: int = 0
    total_services: int = 0


# ===== CLIENT MODELS =====

class Client(BaseModel):
    """Model de Cliente da barbearia."""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barbershop_id: str  # ID da barbearia dona
    name: str
    phone: str
    email: Optional[EmailStr] = None
    notes: Optional[str] = None  # Observações do barbeiro
    history_count: int = 0  # Número de atendimentos
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClientCreate(BaseModel):
    """DTO para criação de cliente."""
    name: str
    phone: str
    email: Optional[EmailStr] = None
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    """DTO para atualização de cliente."""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    """Response model de cliente."""
    model_config = ConfigDict(extra="ignore")
    
    id: str
    name: str
    phone: str
    email: Optional[str]
    notes: Optional[str]
    history_count: int
    created_at: datetime


# ===== SERVICE MODELS =====

class Service(BaseModel):
    """Model de Serviço da barbearia."""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    barbershop_id: str  # ID da barbearia dona
    name: str
    description: Optional[str] = None
    duration_minutes: int  # 30, 45, 60...
    price: float  # Valor em reais
    category: str = "haircut"  # "haircut", "beard", "combo", "other"
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServiceCreate(BaseModel):
    """DTO para criação de serviço."""
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    category: str = "haircut"


class ServiceUpdate(BaseModel):
    """DTO para atualização de serviço."""
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    category: Optional[str] = None
    active: Optional[bool] = None


class ServiceResponse(BaseModel):
    """Response model de serviço."""
    model_config = ConfigDict(extra="ignore")
    
    id: str
    name: str
    description: Optional[str]
    duration_minutes: int
    price: float
    category: str
    active: bool
    created_at: datetime


# ===== STATS MODELS =====

class MasterStats(BaseModel):
    """Estatísticas para painel master."""
    total_barbershops: int
    active_barbershops: int
    pending_barbershops: int
    inactive_barbershops: int
    total_clients: int
    total_services: int
    total_users: int


class BarbershopDashboardStats(BaseModel):
    """Estatísticas para painel da barbearia."""
    barbershop_name: str
    total_clients: int
    total_services: int
    active_services: int
    inactive_services: int
