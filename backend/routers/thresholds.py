from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from models.user import User
from models.enums import UserRole
from models.patient_threshold import PatientThreshold
from core.dependencies import get_token_from_request
from core.security import decode_access_token

router = APIRouter(prefix="/api/v1/thresholds", tags=["Thresholds & Alerts"])

class ThresholdsSchema(BaseModel):
    patient_id: str | None = Field(default=None, description="Patient ID (e.g. p-001)")
    hr_min: int = Field(default=50, ge=30, le=140, description="Minimum resting heart rate")
    hr_max: int = Field(default=110, ge=60, le=220, description="Maximum resting heart rate")
    spo2_min: int = Field(default=92, ge=60, le=100, description="Minimum blood oxygen floor")
    fall_g: float = Field(default=3.0, ge=1.0, le=10.0, description="Fall shock acceleration threshold in g-force")
    room_temp_min: float = Field(default=18.0, ge=5.0, le=35.0, description="Minimum room comfort temp")
    room_temp_max: float = Field(default=26.0, ge=10.0, le=45.0, description="Maximum room comfort temp")

DEFAULT_PATIENT_CONFIGS = {
    "p-001": {
        "hr_min": 55,
        "hr_max": 100,
        "spo2_min": 94,
        "fall_g": 2.8,
        "room_temp_min": 19.0,
        "room_temp_max": 26.0,
    },
    "p-002": {
        "hr_min": 50,
        "hr_max": 95,
        "spo2_min": 92,
        "fall_g": 3.0,
        "room_temp_min": 20.0,
        "room_temp_max": 27.0,
    },
    "p-003": {
        "hr_min": 60,
        "hr_max": 110,
        "spo2_min": 90,
        "fall_g": 2.2,
        "room_temp_min": 21.0,
        "room_temp_max": 26.5,
    },
}

ACTIVE_THRESHOLDS = {
    "hr_min": 50,
    "hr_max": 110,
    "spo2_min": 92,
    "fall_g": 3.0,
    "room_temp_min": 18.0,
    "room_temp_max": 28.0,
}

PATIENT_THRESHOLDS_CACHE: dict[str, dict] = {}


def get_optional_current_user(
    token: str | None = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


def get_or_create_patient_threshold(patient_id: str, db: Session) -> PatientThreshold:
    rec = db.query(PatientThreshold).filter(PatientThreshold.patient_id == patient_id).first()
    if not rec:
        defaults = DEFAULT_PATIENT_CONFIGS.get(patient_id, ACTIVE_THRESHOLDS)
        rec = PatientThreshold(
            patient_id=patient_id,
            hr_min=defaults["hr_min"],
            hr_max=defaults["hr_max"],
            spo2_min=defaults["spo2_min"],
            fall_g=defaults["fall_g"],
            room_temp_min=defaults["room_temp_min"],
            room_temp_max=defaults["room_temp_max"],
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
    return rec


def get_patient_threshold_dict(patient_id: str | None, db: Session | None = None) -> dict:
    if not patient_id:
        return ACTIVE_THRESHOLDS
    patient_key = str(patient_id)
    if patient_key in PATIENT_THRESHOLDS_CACHE:
        return PATIENT_THRESHOLDS_CACHE[patient_key]
    if db is not None:
        try:
            rec = db.query(PatientThreshold).filter(PatientThreshold.patient_id == patient_key).first()
            if rec:
                data = rec.to_dict()
                PATIENT_THRESHOLDS_CACHE[patient_key] = data
                return data
        except Exception:
            db.rollback()
            pass
    if patient_key in DEFAULT_PATIENT_CONFIGS:
        return DEFAULT_PATIENT_CONFIGS[patient_key]
    return ACTIVE_THRESHOLDS


@router.get("", response_model=ThresholdsSchema)
def get_thresholds(
    patient_id: str | None = Query(default=None, description="Optional Patient ID to fetch tailored thresholds"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current alert threshold configuration.
    If patient_id is provided, returns the tailored threshold record stored in PostgreSQL database.
    """
    if patient_id:
        target_id = patient_id.strip()
        rec = get_or_create_patient_threshold(target_id, db)
        return ThresholdsSchema(
            patient_id=rec.patient_id,
            hr_min=rec.hr_min,
            hr_max=rec.hr_max,
            spo2_min=rec.spo2_min,
            fall_g=rec.fall_g,
            room_temp_min=rec.room_temp_min,
            room_temp_max=rec.room_temp_max,
        )

    # Return default active thresholds
    return ThresholdsSchema(
        patient_id="global",
        hr_min=ACTIVE_THRESHOLDS["hr_min"],
        hr_max=ACTIVE_THRESHOLDS["hr_max"],
        spo2_min=ACTIVE_THRESHOLDS["spo2_min"],
        fall_g=ACTIVE_THRESHOLDS["fall_g"],
        room_temp_min=ACTIVE_THRESHOLDS["room_temp_min"],
        room_temp_max=ACTIVE_THRESHOLDS["room_temp_max"],
    )


@router.get("/all")
def get_all_patient_thresholds(
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Care Taker access: Retrieve all patients and their database-stored thresholds.
    """
    recs = db.query(PatientThreshold).all()
    # Seed known defaults if DB is fresh
    existing_ids = {r.patient_id for r in recs}
    for pid in DEFAULT_PATIENT_CONFIGS:
        if pid not in existing_ids:
            get_or_create_patient_threshold(pid, db)

    recs = db.query(PatientThreshold).all()
    return [r.to_dict() for r in recs]


@router.put("", response_model=ThresholdsSchema)
def update_thresholds(
    req: ThresholdsSchema,
    patient_id: str | None = Query(default=None, description="Target patient ID"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Special Care Taker Access: Configure sensor value ranges and alert thresholds per patient.
    Persists changes directly into PostgreSQL database.
    """
    if current_user and current_user.role not in [UserRole.CAREGIVER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Care Taker privileges required to modify sensor thresholds",
        )

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

    target_pid = (patient_id or req.patient_id or "p-001").strip()
    rec = get_or_create_patient_threshold(target_pid, db)

    rec.hr_min = req.hr_min
    rec.hr_max = req.hr_max
    rec.spo2_min = req.spo2_min
    rec.fall_g = req.fall_g
    rec.room_temp_min = req.room_temp_min
    rec.room_temp_max = req.room_temp_max

    db.commit()
    db.refresh(rec)

    # Sync in-memory cache
    PATIENT_THRESHOLDS_CACHE[target_pid] = rec.to_dict()
    ACTIVE_THRESHOLDS["hr_min"] = req.hr_min
    ACTIVE_THRESHOLDS["hr_max"] = req.hr_max
    ACTIVE_THRESHOLDS["spo2_min"] = req.spo2_min
    ACTIVE_THRESHOLDS["fall_g"] = req.fall_g
    ACTIVE_THRESHOLDS["room_temp_min"] = req.room_temp_min
    ACTIVE_THRESHOLDS["room_temp_max"] = req.room_temp_max

    print(f"[Thresholds] Successfully updated database thresholds for patient {target_pid}: HR [{rec.hr_min}-{rec.hr_max}], SpO2 [{rec.spo2_min}%], Fall [{rec.fall_g}g]")

    return ThresholdsSchema(
        patient_id=rec.patient_id,
        hr_min=rec.hr_min,
        hr_max=rec.hr_max,
        spo2_min=rec.spo2_min,
        fall_g=rec.fall_g,
        room_temp_min=rec.room_temp_min,
        room_temp_max=rec.room_temp_max,
    )
