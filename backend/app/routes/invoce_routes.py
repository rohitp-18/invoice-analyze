from app.schemas.user_schema import TokenData
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user_schema as schemas
from app.models import User
import app.utils.utils as utils
from app.authentication import get_current_user

# Create a router to group these endpoints
router = APIRouter(prefix="/invoice", tags=["Authentication"])

db = get_db()

@router.get("/get-all-invoice", status_code=status.HTTP_201_CREATED)
def get_all_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Check if the email already exists in the database
    return {"user": "register_user"}