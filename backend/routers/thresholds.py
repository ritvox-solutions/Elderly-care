from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.enums import UserRole
from core.dependencies import get_current_active_user, require_role

router = APIRouter(prefix="/api/v1/thresholds", tags=["Thresholds & Alerts"])

class ThresholdsSchema(BaseModel):
    hr_min: int = Field(default=50, ge=30, le=120, description="Minimum resting heart rate")
    hr_max: int = Field(default=110, ge=80, le=220, description="Maximum resting heart rate")
    spo2_min: int = Field(default=92, ge=70, le=99, description="Minimum blood oxygen floor")
    fall_g: float = Field(default=3.0, ge=1.5, le=8.0, description="Fall shock acceleration threshold in g-force")
    room_temp_min: float = Field(default=18.0, ge=10.0, le=25.0, description="Minimum room comfort temp")
    room_temp_max: float = Field(default=28.0, ge=22.0, le=40.0, description="Maximum room comfort temp")

# In-memory / DB synced active threshold configuration
ACTIVE_THRESHOLDS = {
    "hr_min": 50,
    "hr_max": 110,
    "spo2_min": 92,
    "fall_g": 3.0,
    "room_temp_min": 18.0,
    "room_temp_max": 28.0,
}

@router.get("", response_model=ThresholdsSchema)
def get_thresholds(current_user: User = Depends(get_current_active_user)):
    """
    Get current alert threshold configuration. Accessible by both Patient and Care Taker.
    """
    return ACTIVE_THRESHOLDS

@router.put("", response_model=ThresholdsSchema)
def update_thresholds(
    req: ThresholdsSchema,
    current_user: User = Depends(require_role(UserRole.CAREGIVER)),
    db: Session = Depends(get_db),
):
    """
    Special Care Taker Access: Configure sensor value ranges and alert thresholds.
    Patients are blocked with 403 Forbidden.
    """
    if req.hr_min >= req.hr_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum heart rate must be less than maximum heart rate",
        )
    if req.room_temp_min >= req.room_temp_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum room temperature must be less than maximum room temperature",
        )

    ACTIVE_THRESHOLDS["hr_min"] = req.hr_min
    ACTIVE_THRESHOLDS["hr_max"] = req.hr_max
    ACTIVE_THRESHOLDS["spo2_min"] = req.spo2_min
    ACTIVE_THRESHOLDS["fall_g"] = req.fall_g
    ACTIVE_THRESHOLDS["room_temp_min"] = req.room_temp_min
    ACTIVE_THRESHOLDS["room_temp_max"] = req.room_temp_max

    return ACTIVE_THRESHOLDS
