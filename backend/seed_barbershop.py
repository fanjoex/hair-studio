"""
Script de seed para popular dados iniciais de teste.
Cria: master admin, barbearia de exemplo, clientes e serviços.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
import bcrypt
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

# Conectar ao MongoDB
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


async def seed_data():
    print("🌱 Iniciando seed de dados...")
    
    # 1. Criar Master Admin
    print("\n1️⃣ Criando Master Admin...")
    master_email = "admin@hairbarber.master"
    master_password = "master123"
    
    existing_master = await db.users.find_one({"email": master_email})
    if not existing_master:
        master_id = str(ObjectId())
        await db.users.insert_one({
            "_id": ObjectId(master_id),
            "name": "Master Admin",
            "email": master_email,
            "password_hash": hash_password(master_password),
            "role": "master_admin",
            "favorites": [],
            "created_at": datetime.now(timezone.utc)
        })
        print(f"   ✅ Master Admin criado: {master_email} / {master_password}")
    else:
        print(f"   ℹ️  Master Admin já existe: {master_email}")
    
    # 2. Criar Barbershop Owner
    print("\n2️⃣ Criando Barbershop Owner...")
    owner_email = "dono@barbeariaprime.com"
    owner_password = "dono123"
    
    existing_owner = await db.users.find_one({"email": owner_email})
    if not existing_owner:
        owner_id = str(ObjectId())
        owner_doc = {
            "_id": ObjectId(owner_id),
            "name": "João Silva",
            "email": owner_email,
            "password_hash": hash_password(owner_password),
            "role": "barbershop_owner",
            "favorites": [],
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(owner_doc)
        print(f"   ✅ Owner criado: {owner_email} / {owner_password}")
    else:
        owner_id = str(existing_owner["_id"])
        # Garantir que role est\u00e1 correto (caso usu\u00e1rio antigo)
        if existing_owner.get("role") != "barbershop_owner":
            await db.users.update_one(
                {"_id": existing_owner["_id"]},
                {"$set": {"role": "barbershop_owner"}}
            )
            print(f"   \u2705 Role atualizada para barbershop_owner: {owner_email}")
        else:
            print(f"   \u2139\ufe0f  Owner j\u00e1 existe: {owner_email}")
    
    # 3. Criar Barbearia
    print("\n3️⃣ Criando Barbearia de Exemplo...")
    barbershop_email = "contato@barbeariaprime.com"
    
    existing_barbershop = await db.barbershops.find_one({"email": barbershop_email})
    if not existing_barbershop:
        barbershop_id = str(uuid.uuid4())
        barbershop_doc = {
            "id": barbershop_id,
            "name": "Barbearia Prime",
            "document": "12.345.678/0001-90",
            "phone": "(11) 98765-4321",
            "email": barbershop_email,
            "address": {
                "street": "Rua dos Barbeiros",
                "number": "123",
                "complement": "Loja 1",
                "neighborhood": "Centro",
                "city": "São Paulo",
                "state": "SP",
                "zip_code": "01234-567"
            },
            "owner_id": owner_id,
            "status": "active",
            "subscription": {
                "plan": "premium",
                "expires_at": None
            },
            "settings": {
                "opening_hours": {
                    "monday": "09:00-18:00",
                    "tuesday": "09:00-18:00",
                    "wednesday": "09:00-18:00",
                    "thursday": "09:00-18:00",
                    "friday": "09:00-19:00",
                    "saturday": "08:00-16:00",
                    "sunday": "Fechado"
                },
                "max_clients": 200,
                "notification_email": barbershop_email
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.barbershops.insert_one(barbershop_doc)
        
        # Atualizar owner com barbershop_id
        await db.users.update_one(
            {"_id": ObjectId(owner_id)},
            {"$set": {"barbershop_id": barbershop_id}}
        )
        
        print(f"   ✅ Barbearia criada: {barbershop_doc['name']}")
    else:
        barbershop_id = existing_barbershop["id"]
        print(f"   ℹ️  Barbearia já existe: {existing_barbershop['name']}")
    
    # 4. Criar Serviços
    print("\n4️⃣ Criando Serviços de Exemplo...")
    services_data = [
        {"name": "Corte Masculino", "description": "Corte completo com máquina e tesoura", "duration_minutes": 45, "price": 45.00, "category": "haircut"},
        {"name": "Barba Completa", "description": "Barba com navalha e finalização", "duration_minutes": 30, "price": 35.00, "category": "beard"},
        {"name": "Corte + Barba", "description": "Combo completo de corte e barba", "duration_minutes": 60, "price": 70.00, "category": "combo"},
        {"name": "Degradê", "description": "Corte degradê estilizado", "duration_minutes": 50, "price": 50.00, "category": "haircut"},
        {"name": "Pezinho", "description": "Acabamento de pezinho e nuca", "duration_minutes": 15, "price": 20.00, "category": "other"},
    ]
    
    for service_data in services_data:
        existing_service = await db.services.find_one({
            "barbershop_id": barbershop_id,
            "name": service_data["name"]
        })
        
        if not existing_service:
            service_doc = {
                "id": str(uuid.uuid4()),
                "barbershop_id": barbershop_id,
                **service_data,
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.services.insert_one(service_doc)
            print(f"   ✅ Serviço criado: {service_data['name']} - R$ {service_data['price']:.2f}")
        else:
            print(f"   ℹ️  Serviço já existe: {service_data['name']}")
    
    # 5. Criar Clientes
    print("\n5️⃣ Criando Clientes de Exemplo...")
    clients_data = [
        {"name": "Carlos Mendes", "phone": "(11) 91234-5678", "email": "carlos@email.com", "notes": "Prefere corte curto"},
        {"name": "Rafael Santos", "phone": "(11) 92345-6789", "email": "rafael@email.com", "notes": "Cliente VIP"},
        {"name": "Lucas Oliveira", "phone": "(11) 93456-7890", "email": None, "notes": "Gosta de degradê"},
        {"name": "Pedro Costa", "phone": "(11) 94567-8901", "email": "pedro@email.com", "notes": None},
        {"name": "Marcos Silva", "phone": "(11) 95678-9012", "email": None, "notes": "Atende apenas sábados"},
    ]
    
    for client_data in clients_data:
        existing_client = await db.clients.find_one({
            "barbershop_id": barbershop_id,
            "phone": client_data["phone"]
        })
        
        if not existing_client:
            client_doc = {
                "id": str(uuid.uuid4()),
                "barbershop_id": barbershop_id,
                **client_data,
                "history_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.clients.insert_one(client_doc)
            print(f"   ✅ Cliente criado: {client_data['name']}")
        else:
            print(f"   ℹ️  Cliente já existe: {client_data['name']}")
    
    print("\n✅ Seed completado com sucesso!\n")
    print("=" * 60)
    print("CREDENCIAIS DE ACESSO:")
    print("=" * 60)
    print(f"\n🔑 Master Admin:")
    print(f"   Email: {master_email}")
    print(f"   Senha: {master_password}")
    print(f"\n🏢 Barbershop Owner:")
    print(f"   Email: {owner_email}")
    print(f"   Senha: {owner_password}")
    print(f"   Barbearia: Barbearia Prime")
    print("\n" + "=" * 60)


async def main():
    try:
        await seed_data()
    except Exception as e:
        print(f"\n❌ Erro durante seed: {str(e)}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
