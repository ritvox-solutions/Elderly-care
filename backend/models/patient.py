import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Date, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.user import GUID

class Patient(Base):
    __tablename__ = "patients"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(50), nullable=True)
    room_number = Column(String(50), nullable=True)
    medical_notes = Column(Text, nullable=True)
    emergency_contact_name = Column(String(150), nullable=False)
    emergency_contact_phone = Column(String(50), nullable=False)
    emergency_contact_email = Column(String(255), nullable=True)
    created_by_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    creator = relationship("User", back_populates="created_patients")
    caregivers = relationship("CaregiverAssignment", back_populates="patient", cascade="all, delete-orphan")
    device_pairings = relationship("DevicePairing", back_populates="patient", cascade="all, delete-orphan")
    readings = relationship("Reading", back_populates="patient")
    alert_rules = relationship("AlertRule", back_populates="patient", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan")
