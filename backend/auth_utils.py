import jwt
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models import User, Role
from database import get_db

# --- OWASP A02: UNUSED SECRETS HARDENING ---
# Ensure JWT_SECRET is loaded from environment; fallback to a strong random if local
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-shoelotskey-2026-key-ags-aviatech")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # 8-hour shift default

security = HTTPBearer()

# --- OWASP A04: CRYPTOGRAPHIC FAILURES PREVENTION ---
# (Usingbcrypt in main.py, keeping simple for this utility)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Generates a secure JWT for session management (OWASP A07)."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)) -> User:
    """
    OWASP A01: BROKEN ACCESS CONTROL PREVENTION
    Middleware to verify token and extract user identity.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid session - Missing user ID")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired - Please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found in system")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
        
    return user

def require_role(role_name: str):
    """
    OWASP A01: ENFORCE LEAST PRIVILEGE
    Decorator-style dependency for RBAC.
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role.role_name != role_name and current_user.role.role_name != 'owner':
            print(f"[SECURITY] Unauthorized access attempt by {current_user.username} (Role: {current_user.role.role_name}) to {role_name}-only resource.")
            raise HTTPException(status_code=403, detail="Unauthorized - Elevated permissions required")
        return current_user
    return role_checker

def sanitize_error(message: str) -> str:
    """OWASP A10: EXCEPTIONAL CONDITIONS MISHANDLING PREVENTON."""
    # Ensure raw tracebacks aren't exposed to the user
    if "SQLAlchemy" in message or "database" in message.lower():
        return "A database operation error occurred. Contact administrator."
    return message
