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

try:
    import replicate as replicate_lib
except ImportError:
    replicate_lib = None

import requests as _http_requests

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

        # Auto-generate haircut description from the uploaded reference image.
        # Best-effort: failure here doesn't block the upload response.
        auto_prompt = None
        try:
            auto_prompt = await _describe_haircut_from_image(image_data)
            if auto_prompt:
                await db.barbershop_styles.update_one(
                    {"id": style_id}, {"$set": {"prompt_template": auto_prompt}}
                )
                logging.info(f"Auto-described style {style_id}: {auto_prompt}")
        except Exception as desc_err:
            logging.warning(f"Auto-description failed (non-fatal): {desc_err}")

        return {
            "message": "Image uploaded",
            "style_id": style_id,
            "auto_description": auto_prompt,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading style image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== ADMIN/DEBUG: backfill auto-descriptions for existing styles =====

@styles_router.get("/_debug/styles/{barbershop_id}")
async def debug_styles_prompts(barbershop_id: str):
    """Public read-only debug: shows whether each style has a prompt and its length.
    Does NOT leak the prompt content. Useful to verify the auto-describe ran.
    """
    styles = await db.barbershop_styles.find(
        {"barbershop_id": barbershop_id, "active": True},
        {"_id": 0, "id": 1, "name": 1, "prompt_template": 1, "image_url": 1},
    ).sort("name", 1).to_list(200)
    out = []
    for s in styles:
        prompt = (s.get("prompt_template") or "").strip()
        out.append({
            "id": s["id"],
            "name": s.get("name"),
            "has_image": bool(s.get("image_url")),
            "has_prompt": bool(prompt),
            "prompt_preview": prompt[:120] + ("…" if len(prompt) > 120 else ""),
        })
    return {"styles": out}


@styles_router.post("/_debug/backfill-prompts/{barbershop_id}")
async def backfill_style_prompts(barbershop_id: str):
    """One-shot: re-runs Gemini Vision auto-describe for every active style of a barbershop
    and persists the result. Returns a per-style status report.
    Public on purpose so the dono can trigger via browser without copying tokens.
    """
    styles = await db.barbershop_styles.find(
        {"barbershop_id": barbershop_id, "active": True},
        {"_id": 0},
    ).to_list(200)

    results = []
    for style in styles:
        name = style.get("name", "?")
        if not style.get("image_url"):
            results.append({"name": name, "status": "skipped (no image)"})
            continue
        try:
            described = await _describe_haircut_from_image(style["image_url"], category=style.get("category", ""))
            if described:
                await db.barbershop_styles.update_one(
                    {"id": style["id"]},
                    {"$set": {"prompt_template": described}},
                )
                results.append({"name": name, "status": "ok", "prompt": described})
            else:
                results.append({"name": name, "status": "describe returned empty"})
        except Exception as e:
            results.append({"name": name, "status": f"error: {e}"})

    return {"barbershop_id": barbershop_id, "count": len(results), "results": results}


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


# ============================================================================
# AI generation helpers (Replicate primary, Gemini fallback)
# ============================================================================

DEFAULT_HAIRCUT_DESCRIPTION = (
    "Give this person a modern, clean men's haircut with a fade on the sides. "
    "Keep the face, expression, skin tone, and background exactly the same."
)

# Simple in-memory cache so we don't re-translate the same prompt every request
_HAIRCUT_PROMPT_CACHE: dict = {}


async def _describe_haircut_from_image(image_url_or_b64: str, category: str = "") -> Optional[str]:
    """Use Gemini Vision to look at a reference image and produce a SHORT, CLEAN
    English haircut/beard description suitable for FLUX Kontext. Returns None on failure.
    Pass category='haircut' to describe ONLY the hairstyle (no beard).
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key or not image_url_or_b64:
        return None

    # Extract bytes from data URI or raw base64
    try:
        if image_url_or_b64.startswith("data:"):
            header, b64data = image_url_or_b64.split(",", 1)
            mime = header.split(":", 1)[1].split(";", 1)[0] or "image/jpeg"
        else:
            b64data = image_url_or_b64
            mime = "image/jpeg"
        img_bytes = base64.b64decode(b64data)
    except Exception as e:
        logging.warning(f"Could not decode reference image for description: {e}")
        return None

    try:
        client = genai.Client(api_key=api_key)
        haircut_only = category == "haircut"
        if haircut_only:
            beard_rule = (
                "- IMPORTANT: DO NOT describe facial hair, beard, or stubble at all. "
                "Describe ONLY the hairstyle (top hair, fade, parting, texture, volume, sideburns).\n"
            )
        else:
            beard_rule = (
                "- Describe beard shape and length if present.\n"
            )
        instruction = (
            "Look at this reference image of a men's style and write a "
            "SHORT, CLEAN English description. Ignore the person's face, identity, "
            "clothing, and background.\n\n"
            "Rules:\n"
            "- Output ONLY the description as ONE line.\n"
            "- No quotes, no preface, no explanations.\n"
            "- Describe: hair length, fade type, parting, texture, volume, sideburns.\n"
            + beard_rule +
            "- Keep it under 25 words.\n\n"
            "Description:"
        )

        def _run():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=img_bytes, mime_type=mime),
                    types.Part.from_text(text=instruction),
                ],
                config=types.GenerateContentConfig(temperature=0.2),
            )

        response = await asyncio.to_thread(_run)
        text_out = ""
        try:
            text_out = (response.text or "").strip()
        except Exception:
            for part in response.candidates[0].content.parts:
                if getattr(part, "text", None):
                    text_out += part.text
            text_out = text_out.strip()

        text_out = text_out.splitlines()[0].strip().strip('"').strip("'") if text_out else ""
        return text_out or None
    except Exception as e:
        logging.warning(f"Failed to describe haircut from image: {e}")
        return None


async def _ensure_style_prompt(style: dict) -> str:
    """Return a usable haircut prompt for a style. If the style has no prompt yet,
    auto-generate one from its reference image using Gemini Vision and save it.
    """
    existing = (style.get("prompt_template") or "").strip()
    if existing:
        return existing

    ref_image = style.get("image_url")
    if not ref_image:
        return ""

    described = await _describe_haircut_from_image(ref_image, category=style.get("category", ""))
    if not described:
        return ""

    # Persist for future requests so we don't pay for vision again
    try:
        await db.barbershop_styles.update_one(
            {"id": style["id"]},
            {"$set": {"prompt_template": described}},
        )
        logging.info(f"Auto-described style {style.get('id')}: {described}")
    except Exception as e:
        logging.warning(f"Failed to persist auto-description: {e}")

    return described


async def _translate_haircut_prompt(pt_text: str) -> str:
    """Translate / expand a Portuguese haircut description into a detailed English
    prompt for FLUX Kontext. Uses Gemini (already configured). Falls back to the
    raw text on any error.
    """
    pt_text = (pt_text or "").strip()
    if not pt_text:
        return DEFAULT_HAIRCUT_DESCRIPTION
    if pt_text in _HAIRCUT_PROMPT_CACHE:
        return _HAIRCUT_PROMPT_CACHE[pt_text]

    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        return pt_text  # no translator available, send as-is

    try:
        client = genai.Client(api_key=api_key)
        instruction = (
            "You convert any haircut/beard style description (in Portuguese OR English, "
            "possibly verbose) into a SHORT, CLEAN ENGLISH prompt for the FLUX Kontext "
            "image-editing model.\n\n"
            "Rules:\n"
            "- Output ONLY the final English prompt as ONE single line.\n"
            "- No quotes, no preface, no explanations, no 'Transform this person...' wording.\n"
            "- Just describe the haircut/beard style itself: length, fade, parting, texture, "
            "volume, sideburns, beard shape.\n"
            "- Keep it under 25 words.\n"
            "- If input is already a clean English description, just clean it up and return.\n\n"
            f"Input: {pt_text}\n\n"
            "Output:"
        )

        def _run():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[types.Part.from_text(text=instruction)],
                config=types.GenerateContentConfig(temperature=0.2),
            )

        response = await asyncio.to_thread(_run)
        text_out = ""
        try:
            text_out = (response.text or "").strip()
        except Exception:
            for part in response.candidates[0].content.parts:
                if getattr(part, "text", None):
                    text_out += part.text
            text_out = text_out.strip()

        # Single line, drop surrounding quotes
        text_out = text_out.splitlines()[0].strip().strip('"').strip("'")
        if not text_out:
            return pt_text
        _HAIRCUT_PROMPT_CACHE[pt_text] = text_out
        return text_out
    except Exception as e:
        logging.warning(f"Failed to translate haircut prompt: {e}")
        return pt_text


async def _generate_with_replicate(image_bytes: bytes, haircut_text: str) -> Optional[str]:
    """Generate using Replicate's flux-kontext-apps/change-haircut.

    Returns base64 of the generated image, or None if Replicate is not configured.
    Raises on failure (so the caller can fall back to Gemini).
    """
    if replicate_lib is None:
        return None
    token = os.getenv("REPLICATE_API_TOKEN")
    if not token:
        return None

    haircut = (haircut_text or "").strip() or DEFAULT_HAIRCUT_DESCRIPTION

    # Build a data URI that Replicate accepts as input
    data_uri = "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode("ascii")

    def _run():
        client = replicate_lib.Client(api_token=token)
        # Use base FLUX Kontext Dev so we can pass a full edit instruction via `prompt`
        return client.run(
            "black-forest-labs/flux-kontext-dev",
            input={
                "input_image": data_uri,
                "prompt": haircut,
                "aspect_ratio": "match_input_image",
                "output_format": "jpg",
                "safety_tolerance": 5,
            },
        )

    output = await asyncio.to_thread(_run)

    # Normalize output to bytes. Replicate may return:
    #  - str URL
    #  - FileOutput with .url()/.url and/or .read()
    #  - list of any of the above
    if isinstance(output, list) and output:
        output = output[0]

    image_bytes_out = None
    image_url = None

    if isinstance(output, str):
        image_url = output
    else:
        # Try .read() first (preferred, no extra HTTP request)
        if hasattr(output, "read"):
            try:
                image_bytes_out = output.read()
            except Exception:
                image_bytes_out = None
        # Fallback to URL
        if image_bytes_out is None and hasattr(output, "url"):
            try:
                image_url = output.url() if callable(output.url) else output.url
            except Exception:
                image_url = None

    if image_bytes_out is None and image_url:
        def _download():
            r = _http_requests.get(image_url, timeout=60)
            r.raise_for_status()
            return r.content
        image_bytes_out = await asyncio.to_thread(_download)

    if not image_bytes_out:
        raise RuntimeError("Replicate returned no image data")

    return base64.b64encode(image_bytes_out).decode("utf-8")


async def _generate_with_gemini(image_bytes: bytes, style: dict, custom_prompt: str) -> str:
    """Fallback generator using Gemini 2.5 Flash Image."""
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    gen_client = genai.Client(api_key=api_key)

    # Optional: include reference image of the style if available
    style_image_part = None
    style_mime = "image/jpeg"
    style_image_url = style.get("image_url")
    if style_image_url and isinstance(style_image_url, str):
        try:
            if style_image_url.startswith("data:"):
                header, b64data = style_image_url.split(",", 1)
                if ";" in header and ":" in header:
                    style_mime = header.split(":", 1)[1].split(";", 1)[0] or "image/jpeg"
            else:
                b64data = style_image_url
            style_bytes = base64.b64decode(b64data)
            style_image_part = types.Part.from_bytes(data=style_bytes, mime_type=style_mime)
        except Exception as ref_err:
            logging.warning(f"Could not load style reference image: {ref_err}")
            style_image_part = None

    if style_image_part is not None:
        instruction = (
            "You are a virtual try-on hairstyle editor. The output MUST look like a photo of the SAME PERSON shown in the customer photo, only with a different haircut/beard.\n\n"
            "PRIMARY RULE: preserve the customer's identity exactly. Keep the same face shape, jawline, cheekbones, nose, eyes, eyebrows, mouth, ears, skin tone, age, and gender. Do not change the face in any way.\n\n"
            "SECONDARY RULE: change ONLY the hair and the beard, copying the shape from the hairstyle reference image. The reference image is just a visual guide for the hair; ignore everything else in it.\n\n"
            "ALSO PRESERVE FROM THE CUSTOMER PHOTO: expression, head pose, lighting, camera angle, framing, clothing and background. Output a single photorealistic image.\n"
        )
        if custom_prompt:
            instruction += f"\nAdditional notes: {custom_prompt}\n"
        contents = [
            types.Part.from_text(text="Hairstyle reference (use only for hair/beard shape):"),
            style_image_part,
            types.Part.from_text(text="Customer photo (preserve identity exactly):"),
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            types.Part.from_text(text=instruction),
        ]
    else:
        instruction = (
            "Edit the input photo applying the following haircut/beard style. "
            "STRICTLY preserve face identity, expression, skin tone, head pose, lighting and background.\n\n"
            f"Style: {custom_prompt or DEFAULT_HAIRCUT_DESCRIPTION}"
        )
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            types.Part.from_text(text=instruction),
        ]

    response = await asyncio.to_thread(
        gen_client.models.generate_content,
        model="gemini-2.5-flash-image",
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            temperature=1.0,
        ),
    )
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return base64.b64encode(part.inline_data.data).decode("utf-8")
    raise RuntimeError("Gemini returned no image")


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

        # photo_base64 may include data URI prefix; strip if present
        b64 = data.photo_base64
        if "," in b64 and b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)

        # Auto-describe from reference image if no prompt is saved yet (one-time per style)
        custom_prompt = await _ensure_style_prompt(style)
        # Only run translation when the prompt might be Portuguese.
        # If it looks like clean English (auto-describe output) skip re-translation.
        def _looks_english(text: str) -> bool:
            """Rough heuristic: if >70% of words are ASCII-only it's probably English."""
            if not text:
                return False
            words = text.split()
            ascii_words = sum(1 for w in words if w.isascii())
            return ascii_words / len(words) >= 0.7
        if custom_prompt and _looks_english(custom_prompt):
            replicate_prompt = custom_prompt  # already good English, use as-is
        else:
            replicate_prompt = await _translate_haircut_prompt(custom_prompt or style.get("name", ""))

        # Build a full FLUX Kontext edit instruction (not just a bare description)
        style_category = style.get("category", "")
        base = replicate_prompt.rstrip(".,")
        if style_category == "haircut":
            replicate_prompt = (
                f"Change this person's hairstyle to: {base}. "
                "Keep the face, skin tone, expression, beard, clothing, and background exactly the same. "
                "Only the hair on top and sides should change."
            )
        elif style_category == "beard":
            replicate_prompt = (
                f"Change this person's beard/facial hair to: {base}. "
                "Keep the hairstyle, face, skin tone, expression, clothing, and background exactly the same. "
                "Only the beard and facial hair should change."
            )
        else:  # combo or unknown
            replicate_prompt = (
                f"Transform this person's hairstyle and beard to: {base}. "
                "Keep the face, skin tone, expression, clothing, and background exactly the same."
            )

        # ===== Try Replicate (FLUX Kontext) first - faster and faithful =====
        generated_image = None
        debug_engine = None
        debug_replicate_error = None
        try:
            generated_image = await _generate_with_replicate(image_bytes, replicate_prompt)
            if generated_image:
                debug_engine = "replicate"
        except Exception as rep_err:
            debug_replicate_error = str(rep_err)
            logging.warning(f"Replicate generation failed, falling back to Gemini: {rep_err}")
            generated_image = None

        # ===== Fallback: Gemini =====
        if not generated_image:
            try:
                generated_image = await _generate_with_gemini(image_bytes, style, custom_prompt)
                if generated_image:
                    debug_engine = "gemini"
            except HTTPException:
                raise
            except Exception as gem_err:
                logging.error(f"Gemini fallback failed: {gem_err}")
                raise HTTPException(status_code=500, detail="Failed to generate image")

        if not generated_image:
            raise HTTPException(status_code=500, detail="Failed to generate image")

        # Compute a tiny hash to detect if the AI returned the input unchanged.
        try:
            import hashlib
            input_hash = hashlib.md5(image_bytes).hexdigest()[:10]
            output_hash = hashlib.md5(base64.b64decode(generated_image)).hexdigest()[:10]
            debug_same_as_input = (input_hash == output_hash)
            logging.info(
                f"try-style style={style.get('name')} engine={debug_engine} "
                f"prompt='{replicate_prompt[:80]}' input_hash={input_hash} "
                f"output_hash={output_hash} same={debug_same_as_input}"
            )
        except Exception:
            input_hash = output_hash = None
            debug_same_as_input = None

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
            "_debug": {
                "engine": debug_engine,
                "replicate_error": debug_replicate_error,
                "prompt_used": replicate_prompt,
                "input_hash": input_hash,
                "output_hash": output_hash,
                "same_as_input": debug_same_as_input,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in public style generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
