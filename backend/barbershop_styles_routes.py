"""
Rotas para gerenciamento de estilos por barbearia + IA pública.
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import Response as RawResponse
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid
import base64
import os
import logging
import io
from PIL import Image
from google import genai
from google.genai import types
import asyncio

styles_router = APIRouter(prefix="/api")
db = None

def set_styles_db(database):
    global db
    db = database


def compress_image(image_bytes: bytes, max_size: int = 400, quality: int = 75) -> tuple:
    """Compress and resize image. Returns (compressed_bytes, mime_type)."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue(), "image/jpeg"


# ===== MODELS =====

class BarbershopStyleCreate(BaseModel):
    name: str
    category: str = "haircut"  # haircut, beard, combo
    description: str = ""
    prompt_template: str = ""
    image_url: Optional[str] = None
    active: bool = True


class BarbershopStyleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    image_url: Optional[str] = None
    active: Optional[bool] = None


class BarbershopStyleResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    barbershop_id: str
    name: str
    category: str
    description: str
    prompt_template: str
    image_url: Optional[str]
    active: bool
    created_at: str


class PublicGenerateRequest(BaseModel):
    photo_base64: str
    style_id: str


# ===== HELPERS =====

async def get_current_user_from_request(request: Request) -> dict:
    from server import get_current_user
    return await get_current_user(request)


async def require_barbershop_access(request: Request) -> tuple:
    user = await get_current_user_from_request(request)
    if user.get("role") == "master_admin":
        return user, None
    if user.get("role") in ["barbershop_owner", "barbershop_staff"]:
        barbershop_id = user.get("barbershop_id")
        if not barbershop_id:
            raise HTTPException(status_code=403, detail="No barbershop")
        return user, barbershop_id
    raise HTTPException(status_code=403, detail="Access denied")


# ===== BARBERSHOP STYLES CRUD =====

@styles_router.get("/barbershop/styles")
async def list_barbershop_styles(request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")
        styles = await db.barbershop_styles.find(
            {"barbershop_id": barbershop_id}, {"_id": 0, "image_url": 0}
        ).sort("name", 1).to_list(100)

        # Check which styles have images
        style_ids = [s["id"] for s in styles]
        image_check = await db.barbershop_styles.find(
            {"barbershop_id": barbershop_id, "id": {"$in": style_ids}, "image_url": {"$ne": None, "$exists": True}},
            {"_id": 0, "id": 1}
        ).to_list(100)
        has_image_ids = {s["id"] for s in image_check}

        for s in styles:
            s["has_image"] = s["id"] in has_image_ids

        return styles
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing barbershop styles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.post("/barbershop/styles")
async def create_barbershop_style(data: BarbershopStyleCreate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")

        style_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Default prompt if empty
        prompt = data.prompt_template
        if not prompt:
            prompts = {
                "haircut": f"Transform this person's hairstyle into a {data.name} haircut, professional barbershop quality",
                "beard": f"Transform this person's beard into a {data.name} beard style, professional grooming quality",
                "combo": f"Transform this person's hairstyle and beard into a {data.name} style, professional barbershop quality",
            }
            prompt = prompts.get(data.category, prompts["haircut"])

        doc = {
            "id": style_id,
            "barbershop_id": barbershop_id,
            "name": data.name,
            "category": data.category,
            "description": data.description,
            "prompt_template": prompt,
            "image_url": data.image_url,
            "active": data.active,
            "created_at": now,
        }
        await db.barbershop_styles.insert_one(doc)
        del doc["_id"]  # Remove MongoDB _id
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating barbershop style: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.put("/barbershop/styles/{style_id}")
async def update_barbershop_style(style_id: str, data: BarbershopStyleUpdate, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": style_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id

        style = await db.barbershop_styles.find_one(query)
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")

        update_dict = data.model_dump(exclude_unset=True)
        if update_dict:
            await db.barbershop_styles.update_one({"id": style_id}, {"$set": update_dict})

        updated = await db.barbershop_styles.find_one({"id": style_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating barbershop style: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.delete("/barbershop/styles/{style_id}")
async def delete_barbershop_style(style_id: str, request: Request):
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": style_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id

        result = await db.barbershop_styles.delete_one(query)
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Style not found")
        return {"message": "Style deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting barbershop style: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.post("/barbershop/styles/{style_id}/upload-image")
async def upload_style_image(style_id: str, file: UploadFile = File(...), request: Request = None):
    """Upload a reference image for a barbershop style (compressed)."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        query = {"id": style_id}
        if barbershop_id:
            query["barbershop_id"] = barbershop_id

        style = await db.barbershop_styles.find_one(query)
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")

        contents = await file.read()
        compressed, mime = compress_image(contents)
        image_b64 = base64.b64encode(compressed).decode("utf-8")
        image_data = f"data:{mime};base64,{image_b64}"

        await db.barbershop_styles.update_one(
            {"id": style_id}, {"$set": {"image_url": image_data}}
        )

        return {"message": "Image uploaded", "style_id": style_id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading style image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== GLOBAL CATALOG: Browse + Import =====

@styles_router.get("/barbershop/styles/catalog")
async def get_global_catalog(request: Request):
    """List the global style catalog with a flag indicating which are already imported."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")

        # Get all global styles
        global_styles = await db.styles.find({}, {"_id": 0}).to_list(200)

        # Get already imported global IDs for this barbershop
        imported = await db.barbershop_styles.find(
            {"barbershop_id": barbershop_id, "global_style_id": {"$exists": True, "$ne": None}},
            {"_id": 0, "global_style_id": 1}
        ).to_list(500)
        imported_ids = {s["global_style_id"] for s in imported}

        for s in global_styles:
            s["imported"] = s["id"] in imported_ids
            # Map global "hair" -> "haircut" so it matches barbershop categories
            if s.get("category") == "hair":
                s["category"] = "haircut"

        return global_styles
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.post("/barbershop/styles/import/{global_id}")
async def import_global_style(global_id: str, request: Request):
    """Import a global style into the barbershop's own collection."""
    try:
        user, barbershop_id = await require_barbershop_access(request)
        if not barbershop_id:
            raise HTTPException(status_code=400, detail="Barbershop ID required")

        # Check if already imported
        existing = await db.barbershop_styles.find_one(
            {"barbershop_id": barbershop_id, "global_style_id": global_id}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Estilo j\u00e1 importado")

        # Fetch global style
        gstyle = await db.styles.find_one({"id": global_id}, {"_id": 0})
        if not gstyle:
            raise HTTPException(status_code=404, detail="Estilo global n\u00e3o encontrado")

        # Map "hair" -> "haircut"
        category = gstyle.get("category", "haircut")
        if category == "hair":
            category = "haircut"

        new_id = str(uuid.uuid4())
        doc = {
            "id": new_id,
            "barbershop_id": barbershop_id,
            "global_style_id": global_id,
            "name": gstyle["name"],
            "category": category,
            "description": gstyle.get("description", ""),
            "prompt_template": gstyle.get("prompt_template", ""),
            "image_url": gstyle.get("image_url"),
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.barbershop_styles.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error importing style: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== PUBLIC: Barbershop styles + AI generation =====

@styles_router.get("/public/barbershop/{barbershop_id}/styles")
async def get_public_barbershop_styles(barbershop_id: str):
    """Get active styles for a barbershop (public). Returns image URLs, not raw base64."""
    try:
        barbershop = await db.barbershops.find_one({"id": barbershop_id, "status": "active"})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")

        styles = await db.barbershop_styles.find(
            {"barbershop_id": barbershop_id, "active": True},
            {"_id": 0, "prompt_template": 0, "image_url": 0}
        ).sort("name", 1).to_list(100)

        # Check which styles have images and build URL references
        style_ids = [s["id"] for s in styles]
        image_check = await db.barbershop_styles.find(
            {"id": {"$in": style_ids}, "image_url": {"$ne": None, "$exists": True}},
            {"_id": 0, "id": 1}
        ).to_list(100)
        has_image_ids = {s["id"] for s in image_check}

        for s in styles:
            s["has_image"] = s["id"] in has_image_ids

        return {"barbershop_name": barbershop["name"], "styles": styles}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting public styles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.get("/public/style-image/{style_id}")
async def get_style_image(style_id: str):
    """Serve a style reference image as binary (not JSON)."""
    try:
        style = await db.barbershop_styles.find_one(
            {"id": style_id}, {"_id": 0, "image_url": 1}
        )
        if not style or not style.get("image_url"):
            raise HTTPException(status_code=404, detail="Image not found")

        image_url = style["image_url"]
        # Parse data URI: data:image/jpeg;base64,xxxxx
        if image_url.startswith("data:"):
            header, b64data = image_url.split(",", 1)
            mime = header.split(":")[1].split(";")[0]
        else:
            b64data = image_url
            mime = "image/jpeg"

        image_bytes = base64.b64decode(b64data)
        return RawResponse(content=image_bytes, media_type=mime,
                          headers={"Cache-Control": "public, max-age=86400"})
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error serving style image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@styles_router.post("/public/barbershop/{barbershop_id}/try-style")
async def public_try_style(barbershop_id: str, data: PublicGenerateRequest, request: Request):
    """Public AI style generation for barbershop clients. Saves to history if logged in as client."""
    try:
        # Try to detect a logged-in client (optional)
        current_user = None
        try:
            from server import get_current_user
            current_user = await get_current_user(request)
        except Exception:
            current_user = None

        barbershop = await db.barbershops.find_one({"id": barbershop_id, "status": "active"})
        if not barbershop:
            raise HTTPException(status_code=404, detail="Barbershop not found")

        style = await db.barbershop_styles.find_one(
            {"id": data.style_id, "barbershop_id": barbershop_id, "active": True}
        )
        if not style:
            raise HTTPException(status_code=404, detail="Style not found")

        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")

        gen_client = genai.Client(api_key=api_key)
        # photo_base64 may include data URI prefix; strip if present
        b64 = data.photo_base64
        if "," in b64 and b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)

        response = await asyncio.to_thread(
            gen_client.models.generate_content,
            model="gemini-2.5-flash-image",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                types.Part.from_text(text=style["prompt_template"])
            ],
            config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"])
        )

        generated_image = None
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                generated_image = base64.b64encode(part.inline_data.data).decode("utf-8")
                break
        if not generated_image:
            raise HTTPException(status_code=500, detail="Failed to generate image")

        # Save to client history if logged in as client
        if current_user and current_user.get("role") == "client":
            try:
                # Strip data URI from input photo for storage too
                original_b64 = b64
                history_doc = {
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["_id"],
                    "barbershop_id": barbershop_id,
                    "barbershop_name": barbershop["name"],
                    "style_id": data.style_id,
                    "style_name": style["name"],
                    "original_image": original_b64,
                    "generated_image": generated_image,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.client_ai_results.insert_one(history_doc)
            except Exception as save_err:
                logging.warning(f"Failed to save client AI history: {save_err}")

        return {
            "style_name": style["name"],
            "generated_image": generated_image,
            "barbershop_name": barbershop["name"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in public style generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
