from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, EmailStr


# Schema for incoming registration/login data
class UserCreate(BaseModel):
    name: Optional[str] = "User"
    email: EmailStr
    password: str
    department: Optional[str] = None
    role: Optional[str] = "EMPLOYEE"


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


# Schema for outgoing user / employee data (hides the password)
class UserResponse(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: EmailStr
    department: Optional[str] = None
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Allows Pydantic to read data from SQLAlchemy ORM models


class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = "EMPLOYEE"
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    email: str | None = None


# Schemas for Team / Department management
class TeamResponse(BaseModel):
    team_name: str
    member_count: int


class TeamDetailResponse(BaseModel):
    team_name: str
    member_count: int
    members: List[UserResponse]