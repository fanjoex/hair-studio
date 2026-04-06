from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import base64
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import bcrypt
import jwt
import secrets
from bson import ObjectId

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"

# Auth helpers
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Models  
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"
    favorites: List[str] = []

class UploadPhotoResponse(BaseModel):
    photo_id: str
    message: str

class GenerateRequest(BaseModel):
    photo_id: str
    style_id: str

class GeneratedResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    photo_id: str
    style_id: str
    style_name: str
    original_image: str
    generated_image: str
    is_public: bool = False
    likes: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    style_name: str
    generated_image: str
    is_public: bool
    likes: int
    created_at: datetime

# Auth endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserRegister, response: Response):
    email = user_data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(ObjectId())
    user_doc = {
        "_id": ObjectId(user_id),
        "name": user_data.name,
        "email": email,
        "password_hash": hash_password(user_data.password),
        "role": "user",
        "favorites": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(id=user_id, name=user_data.name, email=email, role="user", favorites=[])

@api_router.post("/auth/login", response_model=UserResponse)
async def login(credentials: UserLogin, response: Response, request: Request):
    email = credentials.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return UserResponse(
        id=user_id,
        name=user["name"],
        email=user["email"],
        role=user.get("role", "user"),
        favorites=user.get("favorites", [])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(request: Request):
    user = await get_current_user(request)
    return UserResponse(
        id=user["_id"],
        name=user["name"],
        email=user["email"],
        role=user.get("role", "user"),
        favorites=user.get("favorites", [])
    )

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

from styles_data import StyleOption, get_all_styles

# Initialize style catalog
async def init_styles():
    """Initialize style catalog in database if not exists."""
    existing = await db.styles.count_documents({})
    if existing > 0:
        return
    
    styles = get_all_styles()
    for style in styles:
        await db.styles.insert_one(style.model_dump())

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing == None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "favorites": [],
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("startup")
async def startup_event():
    await db.users.create_index("email", unique=True)
    await init_styles()
    await seed_admin()

@api_router.get("/")
async def root():
    return {"message": "AI Hair & Beard Studio API"}

@api_router.post("/upload-photo", response_model=UploadPhotoResponse)
async def upload_photo(file: UploadFile = File(...), request: Request = None):
    try:
        user = None
        try:
            user = await get_current_user(request) if request else None
        except:
            pass
        
        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        photo_id = str(uuid.uuid4())
        photo_doc = {
            "id": photo_id,
            "user_id": user["_id"] if user else None,
            "image_data": image_base64,
            "filename": file.filename,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.photos.insert_one(photo_doc)
        
        return UploadPhotoResponse(
            photo_id=photo_id,
            message="Photo uploaded successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/styles", response_model=List[StyleOption])
async def get_styles():
    styles = await db.styles.find({}, {"_id": 0}).to_list(100)
    return styles

@api_router.post("/styles/{style_id}/favorite")
async def toggle_favorite(style_id: str, request: Request):
    user = await get_current_user(request)
    user_id = user["_id"]
    
    current_favorites = user.get("favorites", [])
    if style_id in current_favorites:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$pull": {"favorites": style_id}})
        await db.styles.update_one({"id": style_id}, {"$inc": {"favorites_count": -1}})
        return {"favorited": False}
    else:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {"favorites": style_id}})
        await db.styles.update_one({"id": style_id}, {"$inc": {"favorites_count": 1}})
        return {"favorited": True}

@api_router.post("/generate", response_model=GeneratedResult)
async def generate_style(request_data: GenerateRequest, request: Request):
    try:
        user = None
        try:
            user = await get_current_user(request)
        except:
            pass
        
        photo = await db.photos.find_one({"id": request_data.photo_id}, {"_id": 0})
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        style = await db.styles.find_one({"id": request_data.style_id}, {"_id": 0})
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        session_id = f"session-{uuid.uuid4()}"
        chat = LlmChat(api_key=api_key, session_id=session_id, system_message="You are a professional hair and beard styling AI assistant.")
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(
            text=style["prompt_template"],
            file_contents=[ImageContent(photo["image_data"])]
        )
        
        text, images = await chat.send_message_multimodal_response(msg)
        
        if not images or len(images) == 0:
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
        generated_image = images[0]['data']
        
        result = GeneratedResult(
            user_id=user["_id"] if user else None,
            photo_id=request_data.photo_id,
            style_id=request_data.style_id,
            style_name=style["name"],
            original_image=photo["image_data"],
            generated_image=generated_image,
            is_public=False
        )
        
        result_dict = result.model_dump()
        result_dict['created_at'] = result_dict['created_at'].isoformat()
        await db.results.insert_one(result_dict)
        
        return result
        
    except Exception as e:
        logging.error(f"Generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[HistoryItem])
async def get_history(request: Request):
    user = None
    try:
        user = await get_current_user(request)
    except:
        pass
    
    query = {"user_id": user["_id"]} if user else {}
    results = await db.results.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    history = []
    for r in results:
        if isinstance(r['created_at'], str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
        history.append(HistoryItem(
            id=r['id'],
            style_name=r['style_name'],
            generated_image=r['generated_image'],
            is_public=r.get('is_public', False),
            likes=r.get('likes', 0),
            created_at=r['created_at']
        ))
    
    return history

@api_router.get("/gallery/public", response_model=List[HistoryItem])
async def get_public_gallery():
    results = await db.results.find({"is_public": True}, {"_id": 0}).sort("likes", -1).limit(50).to_list(50)
    
    gallery = []
    for r in results:
        if isinstance(r['created_at'], str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
        gallery.append(HistoryItem(
            id=r['id'],
            style_name=r['style_name'],
            generated_image=r['generated_image'],
            is_public=r.get('is_public', False),
            likes=r.get('likes', 0),
            created_at=r['created_at']
        ))
    
    return gallery

@api_router.post("/result/{result_id}/public")
async def toggle_public(result_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.results.find_one({"id": result_id, "user_id": user["_id"]})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    new_status = not result.get("is_public", False)
    await db.results.update_one({"id": result_id}, {"$set": {"is_public": new_status}})
    return {"is_public": new_status}

@api_router.post("/result/{result_id}/like")
async def like_result(result_id: str):
    result = await db.results.find_one({"id": result_id})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    await db.results.update_one({"id": result_id}, {"$inc": {"likes": 1}})
    return {"likes": result.get("likes", 0) + 1}

@api_router.get("/result/{result_id}")
async def get_result(result_id: str):
    result = await db.results.find_one({"id": result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    if isinstance(result['created_at'], str):
        result['created_at'] = datetime.fromisoformat(result['created_at'])
    
    return result

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get('FRONTEND_URL', 'https://virtual-barber-8.preview.emergentagent.com')],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()