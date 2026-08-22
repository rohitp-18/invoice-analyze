from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user_schema import TokenData
from app.utils import utils
from app.database import SessionLocal

# OAuth2 password bearer scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. Decode the JWT using the configured secret key
        payload = jwt.decode(token, utils.SECRET_KEY, algorithms=[utils.ALGORITHM])
        
        # 2. Extract the email (subject) from the payload
        email: str = payload.get("sub", "")
        if not email:
            raise credentials_exception
            
        token_data = TokenData(email=email)
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

    # 3. Fetch the user from PostgreSQL
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
        
    return user


def require_compliance_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Role-Based Access Control (RBAC) Dependency.
    Ensures the requesting user belongs to the Compliance/Admin role or department.
    """
    role = (current_user.role or "").upper()
    department = (current_user.department or "").upper()

    allowed_roles = {"ADMIN", "COMPLIANCE", "AUDITOR", "SUPERADMIN"}
    allowed_departments = {"COMPLIANCE", "ADMIN", "LEGAL", "AUDIT"}

    if role not in allowed_roles and department not in allowed_departments:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Corporate policy management requires Compliance or Admin authorization.",
        )
    
    return current_user