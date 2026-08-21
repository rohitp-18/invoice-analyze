from pydantic import BaseModel, EmailStr

# Schema for incoming registration/login data
class UserCreate(BaseModel):
    email: EmailStr
    password: str

# Schema for outgoing user data (hides the password)
class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        from_attributes = True  # Allows Pydantic to read data from SQLAlchemy ORM models

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: str | None = None