from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class StyleOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str  # 'hair' or 'beard'
    description: str
    image_url: Optional[str] = None
    prompt_template: str

class UploadPhotoResponse(BaseModel):
    photo_id: str
    message: str

class GenerateRequest(BaseModel):
    photo_id: str
    style_id: str

class GeneratedResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    photo_id: str
    style_id: str
    style_name: str
    original_image: str  # base64
    generated_image: str  # base64
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    style_name: str
    generated_image: str
    created_at: datetime

# Initialize style catalog
async def init_styles():
    existing = await db.styles.count_documents({})
    if existing > 0:
        return
    
    styles = [
        # Haircuts
        StyleOption(
            name="Modern Fade",
            category="hair",
            description="Clean modern fade with tapered sides",
            image_url="https://images.unsplash.com/photo-1769071167442-3b67ea1eb769?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwzfHxtYW4lMjBtb2Rlcm4lMjBoYWlyY3V0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc1NDc4MDk1fDA&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person's hairstyle into a modern fade haircut with clean tapered sides and short top, professional barbershop quality"
        ),
        StyleOption(
            name="Textured Crop",
            category="hair",
            description="Textured short crop with movement",
            image_url="https://images.unsplash.com/photo-1772798921699-69445b09c598?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwxfHxtYW4lMjBtb2Rlcm4lMjBoYWlyY3V0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc1NDc4MDk1fDA&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person's hairstyle into a textured crop haircut with natural movement and layered texture on top"
        ),
        StyleOption(
            name="Slick Back",
            category="hair",
            description="Classic slicked back style",
            image_url="https://images.unsplash.com/photo-1769072058450-ac7cc0d0a541?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNTl8MHwxfHNlYXJjaHwyfHxtYW4lMjBtb2Rlcm4lMjBoYWlyY3V0JTIwcG9ydHJhaXR8ZW58MHx8fHwxNzc1NDc4MDk1fDA&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person's hairstyle into a classic slicked back hairstyle, smooth and polished with hair combed backwards"
        ),
        StyleOption(
            name="Buzz Cut",
            category="hair",
            description="Ultra short military style",
            prompt_template="Transform this person's hairstyle into a buzz cut, ultra short military style haircut with uniform length all around"
        ),
        StyleOption(
            name="Pompadour",
            category="hair",
            description="High volume classic pompadour",
            prompt_template="Transform this person's hairstyle into a high volume pompadour with swept up front and volumized top"
        ),
        StyleOption(
            name="Quiff",
            category="hair",
            description="Modern quiff with volume",
            prompt_template="Transform this person's hairstyle into a modern quiff with textured volume on top and styled upwards"
        ),
        StyleOption(
            name="Undercut",
            category="hair",
            description="Disconnected undercut style",
            prompt_template="Transform this person's hairstyle into an undercut with long hair on top and shaved/very short sides"
        ),
        StyleOption(
            name="Man Bun",
            category="hair",
            description="Long hair tied in bun",
            prompt_template="Transform this person's hairstyle into long hair styled in a man bun on top of the head"
        ),
        StyleOption(
            name="French Crop",
            category="hair",
            description="Short fringe crop",
            prompt_template="Transform this person's hairstyle into a French crop with short textured fringe and faded sides"
        ),
        StyleOption(
            name="Side Part",
            category="hair",
            description="Classic side parted style",
            prompt_template="Transform this person's hairstyle into a classic side part with clean defined part line and combed sides"
        ),
        StyleOption(
            name="Caesar Cut",
            category="hair",
            description="Short horizontal fringe",
            prompt_template="Transform this person's hairstyle into a Caesar cut with short horizontal fringe and uniform length"
        ),
        StyleOption(
            name="Curly Top",
            category="hair",
            description="Natural curly texture on top",
            prompt_template="Transform this person's hairstyle into curly hair on top with natural texture and faded sides"
        ),
        # Beards
        StyleOption(
            name="Full Beard",
            category="beard",
            description="Full natural beard",
            image_url="https://images.unsplash.com/photo-1653071163517-4ee6b192260d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwyfHxtYW4lMjBiZWFyZCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTQ3ODA5NXww&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person to have a full natural beard covering cheeks, chin and neck with natural growth"
        ),
        StyleOption(
            name="Goatee",
            category="beard",
            description="Classic goatee style",
            image_url="https://images.unsplash.com/photo-1653071163695-34ac45a78e28?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwzfHxtYW4lMjBiZWFyZCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTQ3ODA5NXww&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person to have a goatee beard style with hair only on chin and mustache area"
        ),
        StyleOption(
            name="Short Stubble",
            category="beard",
            description="Light stubble beard",
            image_url="https://images.unsplash.com/photo-1653071163845-c5851ddedf95?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxtYW4lMjBiZWFyZCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NTQ3ODA5NXww&ixlib=rb-4.1.0&q=85",
            prompt_template="Transform this person to have short stubble beard, light 2-3 day growth all over face"
        ),
        StyleOption(
            name="Long Beard",
            category="beard",
            description="Long flowing beard",
            prompt_template="Transform this person to have a long flowing beard extending several inches from the chin"
        ),
        StyleOption(
            name="Chinstrap",
            category="beard",
            description="Thin beard along jawline",
            prompt_template="Transform this person to have a chinstrap beard style following the jawline from ear to ear"
        ),
        StyleOption(
            name="Van Dyke",
            category="beard",
            description="Goatee with mustache",
            prompt_template="Transform this person to have a Van Dyke beard style with pointed goatee and disconnected mustache"
        ),
        StyleOption(
            name="Handlebar Mustache",
            category="beard",
            description="Styled handlebar mustache",
            prompt_template="Transform this person to have a handlebar mustache with curled upward ends and no chin beard"
        ),
        StyleOption(
            name="Clean Shaven",
            category="beard",
            description="Completely smooth face",
            prompt_template="Transform this person to be completely clean shaven with smooth skin and no facial hair"
        ),
        StyleOption(
            name="5 O'Clock Shadow",
            category="beard",
            description="Very light stubble",
            prompt_template="Transform this person to have a 5 o'clock shadow with very light stubble barely visible"
        ),
        StyleOption(
            name="Corporate Beard",
            category="beard",
            description="Well-groomed professional beard",
            prompt_template="Transform this person to have a well-groomed corporate beard, neat and professional looking"
        ),
        StyleOption(
            name="Circle Beard",
            category="beard",
            description="Mustache connected to goatee",
            prompt_template="Transform this person to have a circle beard with mustache fully connected to rounded goatee"
        ),
        StyleOption(
            name="Mutton Chops",
            category="beard",
            description="Side whiskers style",
            prompt_template="Transform this person to have mutton chops beard style with large sideburns extending down to corners of mouth"
        )
    ]
    
    for style in styles:
        await db.styles.insert_one(style.model_dump())

@app.on_event("startup")
async def startup_event():
    await init_styles()

@api_router.get("/")
async def root():
    return {"message": "AI Hair & Beard Studio API"}

@api_router.post("/upload-photo", response_model=UploadPhotoResponse)
async def upload_photo(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image_base64 = base64.b64encode(contents).decode('utf-8')
        
        photo_id = str(uuid.uuid4())
        photo_doc = {
            "id": photo_id,
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

@api_router.post("/generate", response_model=GeneratedResult)
async def generate_style(request: GenerateRequest):
    try:
        # Get photo
        photo = await db.photos.find_one({"id": request.photo_id}, {"_id": 0})
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        # Get style
        style = await db.styles.find_one({"id": request.style_id}, {"_id": 0})
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")
        
        # Generate with AI
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
        
        # Save result
        result = GeneratedResult(
            photo_id=request.photo_id,
            style_id=request.style_id,
            style_name=style["name"],
            original_image=photo["image_data"],
            generated_image=generated_image
        )
        
        result_dict = result.model_dump()
        result_dict['created_at'] = result_dict['created_at'].isoformat()
        await db.results.insert_one(result_dict)
        
        return result
        
    except Exception as e:
        logging.error(f"Generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[HistoryItem])
async def get_history():
    results = await db.results.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    history = []
    for r in results:
        if isinstance(r['created_at'], str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
        history.append(HistoryItem(
            id=r['id'],
            style_name=r['style_name'],
            generated_image=r['generated_image'],
            created_at=r['created_at']
        ))
    
    return history

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
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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