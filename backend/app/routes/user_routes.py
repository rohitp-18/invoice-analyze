from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user_schema as schemas
from app.models.user_model import User
import app.utils.utils as utils
from app.authentication import get_current_user

# Create a router to group these endpoints
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

db = get_db()

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Check if the email already exists in the database
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Hash the password
    print(f"Password before hashing: {user.password}, Length: {len(user.password)}")
    hashed_pwd = utils.get_password_hash(str(user.password[:72]))
    
    # 3. Create the new user and save to PostgreSQL
    new_user = User(email=user.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    access_token = utils.create_access_token(data={"sub": new_user.email})
    
    return {new_user, access_token}
@router.post("/login", response_model=schemas.Token)
def login_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. Find the user by email
    db_user = db.query(User).filter(User.email == user.email).first()
    
    # 2. Check if user exists and verify password
    if not db_user or not utils.verify_password(user.password, str(db_user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Generate the JWT access token using the user's email as the subject ("sub")
    access_token = utils.create_access_token(data={"sub": db_user.email})
    
    # 4. Return the token to the client
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    # Return the current authenticated user
    return current_user