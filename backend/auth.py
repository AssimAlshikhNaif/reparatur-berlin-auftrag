import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr

from db import db

JWT_ALGORITHM = "HS256"

# Detect Environment mode for Cookie Security Settings
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development").lower() == "production"


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret():
    return os.environ.get("JWT_SECRET", "default_fallback_secret_key_change_in_production")


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, 
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12), 
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), 
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    # Dynamic secure flag based on HTTP / HTTPS environment
    is_secure = IS_PRODUCTION
    same_site = "none" if is_secure else "lax"

    response.set_cookie(
        key="access_token", 
        value=access, 
        httponly=True, 
        secure=is_secure,
        samesite=same_site, 
        max_age=43200, 
        path="/"
    )
    response.set_cookie(
        key="refresh_token", 
        value=refresh, 
        httponly=True, 
        secure=is_secure,
        samesite=same_site, 
        max_age=604800, 
        path="/"
    )


def clean_user(user: dict) -> dict:
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def decode_user_from_token(token: str):
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            return None
        return user
    except jwt.PyJWTError:
        return None


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    user = await decode_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sitzung ungültig oder abgelaufen")
    return user


def require_roles(*roles):
    async def checker(current=Depends(get_current_user)):
        if current.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Keine Berechtigung für diese Aktion")
        return current
    return checker


auth_router = APIRouter(prefix="/api/auth")


class LoginInput(BaseModel):
    email: EmailStr
    password: str


@auth_router.post("/login")
async def login(input: LoginInput, response: Response, request: Request):
    email = input.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until_raw = attempt.get("locked_until")
        if locked_until_raw:
            locked_until = datetime.fromisoformat(locked_until_raw) if isinstance(locked_until_raw, str) else locked_until_raw
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(status_code=429, detail="Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user["password_hash"]):
        now = datetime.now(timezone.utc)
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (now + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort ist falsch")

    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": clean_user(dict(user)), "access_token": access}


@auth_router.post("/logout")
async def logout(response: Response, current=Depends(get_current_user)):
    is_secure = IS_PRODUCTION
    same_site = "none" if is_secure else "lax"
    
    response.delete_cookie("access_token", path="/", samesite=same_site, secure=is_secure)
    response.delete_cookie("refresh_token", path="/", samesite=same_site, secure=is_secure)
    return {"message": "Abgemeldet"}


@auth_router.get("/me")
async def me(current=Depends(get_current_user)):
    return clean_user(dict(current))


@auth_router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Kein Refresh-Token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Ungültiger Token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
        access = create_access_token(str(user["_id"]), user["email"])
        
        is_secure = IS_PRODUCTION
        same_site = "none" if is_secure else "lax"
        
        response.set_cookie(
            key="access_token", 
            value=access, 
            httponly=True, 
            secure=is_secure,
            samesite=same_site, 
            max_age=43200, 
            path="/"
        )
        return {"access_token": access}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")