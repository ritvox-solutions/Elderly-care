import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from settings import get_settings

settings = get_settings()

db_url = settings.database_url

if os.getenv("VERCEL") and db_url.startswith("sqlite") and "/tmp/" not in db_url:
    db_url = "sqlite:////tmp/caretrack.db"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
