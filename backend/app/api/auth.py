from datetime import datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import COOKIE_NAME, get_current_user, hash_password, token_digest, verify_password
from app.db.database import get_db
from app.models.models import AuthSessionModel, UserModel

router = APIRouter(prefix="/api/auth", tags=["Authentification"])
settings = get_settings()
SESSION_DAYS = 7

class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=10, max_length=256)


class RegistrationPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=10, max_length=256)
    password_confirmation: str = Field(min_length=10, max_length=256)


def _start_session(user: UserModel, response: Response, db: Session) -> None:
    token = secrets.token_urlsafe(32)
    db.add(AuthSessionModel(user_id=user.id, token_hash=token_digest(token), expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS), mfa_verified=True))
    db.commit()
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400, httponly=True, secure=settings.AUTH_COOKIE_SECURE, samesite="strict", path="/")


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegistrationPayload, db: Session = Depends(get_db)):
    if payload.password != payload.password_confirmation:
        raise HTTPException(status_code=400, detail="Les mots de passe ne correspondent pas.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Le nom est obligatoire.")
    email = str(payload.email).strip().lower()
    if db.query(UserModel).filter(func.lower(UserModel.email) == email).first():
        raise HTTPException(status_code=409, detail="Cette adresse e-mail est deja utilisee.")
    user = UserModel(name=name, email=email, password_hash=hash_password(payload.password), email_verified=True)
    db.add(user)
    db.flush()
    db.commit()
    db.refresh(user)
    return {"message": "Compte cree. Vous pouvez maintenant vous connecter."}


@router.post("/login")
def login(payload: Credentials, response: Response, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    user = db.query(UserModel).filter(func.lower(UserModel.email) == email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Adresse e-mail ou mot de passe incorrect.")
    _start_session(user, response, db)
    return {"id": user.id, "name": user.name, "email": user.email}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        session = db.query(AuthSessionModel).filter(AuthSessionModel.token_hash == token_digest(token)).first()
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, secure=settings.AUTH_COOKIE_SECURE, samesite="strict")


@router.get("/me")
def me(user: UserModel = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "email": user.email}
