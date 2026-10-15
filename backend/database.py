import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from settings import get_settings

settings = get_settings()

db_url = settings.database_url

# Strip problematic channel_binding if present
if "channel_binding=require" in db_url:
    db_url = db_url.replace("&channel_binding=require", "").replace("channel_binding=require&", "").replace("?channel_binding=require", "")

if os.getenv("VERCEL") and db_url.startswith("sqlite") and "/tmp/" not in db_url:
    db_url = "sqlite:////tmp/caretrack.db"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {"connect_timeout": 15}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,  # Recycle connection every 5 mins to handle Neon auto-suspend cleanly
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
