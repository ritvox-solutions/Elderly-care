from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
import uuid
from models.enums import UserRole

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(min_length=2)
    role: UserRole = UserRole.CAREGIVER
    phone_number: str | None = None

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    phone_number: str | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PushTokenRequest(BaseModel):
    token: str = Field(
        min_length=20,
        max_length=255,
        pattern=r"^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]+\]$",
    )

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
