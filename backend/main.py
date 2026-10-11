# main.py
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Crisis Relief Assistance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/people", response_model=schemas.PersonResponse, status_code=status.HTTP_201_CREATED)
def register_person(person: schemas.PersonCreate, db: Session = Depends(get_db)):
    db_person = models.PersonInNeed(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person

@app.get("/api/people", response_model=List[schemas.PersonResponse])
def get_people(urgency, category, db):
    query = db.query(models.PersonInNeed)
    if urgency:
        query = query.filter(models.PersonInNeed.urgency_level == urgency.upper())
    if category:
        query = query.filter(models.PersonInNeed.needs_category.ilike(f"%{category}%"))
    return query.all()