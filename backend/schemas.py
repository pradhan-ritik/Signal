# schemas.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

DEFAULT_URGENCY = "MEDIUM"

# Schema for incoming request data from JS Frontend
class PersonCreate(BaseModel):
    full_name: str
    contact_info: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    needs_category: str
    urgency_level: str = DEFAULT_URGENCY 
    notes: Optional[str] = None

# Schema for sending response back to Frontend
class PersonResponse(PersonCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True