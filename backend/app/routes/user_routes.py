from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
import app.schemas.user_schema as schemas
from app.models import User
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
    new_user = User(
        name=user.name if user.name else user.email.split("@")[0],
        email=user.email,
        department=user.department,
        role=user.role if user.role else "EMPLOYEE",
        hashed_password=hashed_pwd,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user
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
    
    # 3. Generate the JWT access token using the user's email and role
    access_token = utils.create_access_token(data={"sub": db_user.email, "role": db_user.role})
    
    # 4. Return the token and user metadata to the client
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role,
        "user": db_user,
    }

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    # Return the current authenticated user
    return current_user


@router.put("/me", response_model=schemas.UserResponse)
def update_current_user(
    profile_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update profile details for the authenticated user.
    """
    if profile_data.name is not None and profile_data.name.strip():
        current_user.name = profile_data.name.strip()
    if profile_data.department is not None and profile_data.department.strip():
        current_user.department = profile_data.department.strip()
    if profile_data.password and len(profile_data.password.strip()) >= 4:
        current_user.hashed_password = utils.get_password_hash(str(profile_data.password.strip()[:72]))

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_user_password(
    data: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change password after verifying current password.
    """
    if not utils.verify_password(data.current_password, str(current_user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if len(data.new_password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long.",
        )
    current_user.hashed_password = utils.get_password_hash(str(data.new_password.strip()[:72]))
    db.commit()
    return {"message": "Password updated successfully."}