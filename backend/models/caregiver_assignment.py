import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from models.user import GUID

class CaregiverAssignment(Base):
    __tablename__ = "caregiver_assignments"
    __table_args__ = (
        UniqueConstraint("caregiver_id", "patient_id", name="uq_caregiver_patient"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    caregiver_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(GUID, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    caregiver = relationship("User", back_populates="caregiver_assignments")
    patient = relationship("Patient", back_populates="caregivers")
