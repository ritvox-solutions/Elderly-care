from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base

class PatientThreshold(Base):
    __tablename__ = "patient_thresholds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String(100), unique=True, index=True, nullable=False)
    hr_min = Column(Integer, default=50, nullable=False)
    hr_max = Column(Integer, default=110, nullable=False)
    spo2_min = Column(Integer, default=92, nullable=False)
    fall_g = Column(Float, default=3.0, nullable=False)
    room_temp_min = Column(Float, default=18.0, nullable=False)
    room_temp_max = Column(Float, default=28.0, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self):
        return {
            "patient_id": self.patient_id,
            "hr_min": self.hr_min,
            "hr_max": self.hr_max,
            "spo2_min": self.spo2_min,
            "fall_g": self.fall_g,
            "room_temp_min": self.room_temp_min,
            "room_temp_max": self.room_temp_max,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
