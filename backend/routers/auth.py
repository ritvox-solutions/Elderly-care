from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.audit_log import AuditLog
from schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from core.security import hash_password, verify_password, create_access_token
from core.dependencies import get_current_active_user
import json

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists",
        )
    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        role=req.role.value,
        phone_number=req.phone_number.strip() if req.phone_number else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=user.id,
        action="USER_REGISTERED",
        resource_type="USER",
        resource_id=str(user.id),
        details=json.dumps({"email": user.email, "role": user.role}),
    )
    db.add(audit)
    db.commit()

    return user

@router.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    token = create_access_token(subject=user.id, role=user.role)

    response.set_cookie(
        key="access_token",
        value=f"Bearer {token}",
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
    )

    audit = AuditLog(
        user_id=user.id,
        action="USER_LOGIN_SUCCESS",
        resource_type="USER",
        resource_id=str(user.id),
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    response.delete_cookie(key="access_token")
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_LOGOUT",
        resource_type="USER",
        resource_id=str(current_user.id),
    )
    db.add(audit)
    db.commit()
    return {"status": "logged_out", "message": "Successfully logged out and session cleared"}

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    return current_user
