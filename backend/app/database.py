from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Base

# Dynamically select active database based on ENVIRONMENT
SQLALCHEMY_DATABASE_URL = settings.active_database_url

masked_url = (
    SQLALCHEMY_DATABASE_URL.split("@")[-1]
    if "@" in SQLALCHEMY_DATABASE_URL
    else SQLALCHEMY_DATABASE_URL
)
print(f"[Database] Active Environment: '{settings.ENVIRONMENT.upper()}' | Connecting to: {masked_url}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables defined in app.models (users, invoices, line items, anomalies)
Base.metadata.create_all(bind=engine)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()