"""Style definitions for hair and beard options."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid


class StyleOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    description: str
    image_url: Optional[str] = None
    prompt_template: str
    favorites_count: int = 0


def get_hair_styles():
    """Return list of hair style options."""
    return [
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
    ]


def get_beard_styles():
    """Return list of beard style options."""
    return [
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
        ),
    ]


def get_all_styles():
    """Return all hair and beard styles combined."""
    return get_hair_styles() + get_beard_styles()
