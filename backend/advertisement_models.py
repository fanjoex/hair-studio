"""
Models para propagandas/produtos afiliados.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid


class Advertisement(BaseModel):
    """Modelo de propaganda/produto."""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Nome do produto
    brand: str  # Marca
    price: str  # Preço formatado (ex: "R$ 89,90")
    description: str  # Descrição curta
    image_url: Optional[str] = None  # URL da imagem (ou null para SVG placeholder)
    affiliate_url: str  # Link de afiliado ou link próprio
    
    # Controle de acesso
    barbershop_id: Optional[str] = None  # null = global (admin), str = específica da barbershop
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdvertisementCreate(BaseModel):
    """DTO para criar propaganda."""
    name: str
    brand: str
    price: str
    description: str
    image_url: Optional[str] = None
    affiliate_url: str


class AdvertisementUpdate(BaseModel):
    """DTO para atualizar propaganda."""
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    affiliate_url: Optional[str] = None
    is_active: Optional[bool] = None
