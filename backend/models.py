# models.py
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from database import Base

class persion_in_need(Base):
    __tablename__ = "people_in_need"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, nullable=False)
    contact_info = Column(String, nullable=False) 
    location = Column(String, nullable=False)     
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    needs_category = Column(String, index=True)   
    urgency_level = Column(String, default="MEDIUM") 
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))