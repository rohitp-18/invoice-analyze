from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Replace user, password, localhost, and dbname with your actual PostgreSQL credentials
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Rohit18@localhost/invoices"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()