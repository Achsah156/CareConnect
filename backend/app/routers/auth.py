from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, GoogleAuthRequest, UserOut
from app.services.google_oauth import exchange_code_for_profile, GoogleOAuthError

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user_id: str) -> None:
    token = create_access_token(user_id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _set_auth_cookie(response, str(user.id))
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _set_auth_cookie(response, str(user.id))
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"detail": "Logged out"}


@router.post("/google", response_model=UserOut)
def google_auth(payload: GoogleAuthRequest, response: Response, db: Session = Depends(get_db)):
    """
    Exchanges the authorization code the frontend received from Google
    for a profile, then finds or creates a matching User.

    redirect_uri must exactly match what was used to initiate the consent
    flow on the frontend — Google validates this and will reject the
    exchange otherwise.
    """
    try:
        profile = exchange_code_for_profile(payload.code, payload.redirect_uri)
    except GoogleOAuthError:
        raise HTTPException(status_code=401, detail="Google authentication failed")

    google_id = profile["sub"]
    email = profile["email"]
    name = profile.get("name", email.split("@")[0])

    user = db.query(User).filter(User.google_id == google_id).first()

    if user is None:
        # No account linked to this Google id yet. If an account already
        # exists with the same email (e.g. they originally signed up with
        # a password), link Google to that existing account rather than
        # creating a duplicate user.
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.google_id = google_id
        else:
            user = User(email=email, google_id=google_id, display_name=name)
            db.add(user)
        db.commit()
        db.refresh(user)

    _set_auth_cookie(response, str(user.id))
    return user
