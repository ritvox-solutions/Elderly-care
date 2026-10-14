import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.user import GUID
from models.enums import DeviceType, DeviceStatus

class Device(Base):
    __tablename__ = "devices"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    device_identifier = Column(String(100), unique=True, index=True, nullable=False)
    device_type = Column(String(50), nullable=False)
    mac_address = Column(String(50), nullable=True)
    firmware_version = Column(String(50), nullable=True)
    status = Column(String(50), default=DeviceStatus.UNPAIRED.value, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    pairings = relationship("DevicePairing", back_populates="device", cascade="all, delete-orphan")

class DevicePairing(Base):
    __tablename__ = "device_pairings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    device_id = Column(GUID, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(GUID, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    paired_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    unpaired_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    device = relationship("Device", back_populates="pairings")
    patient = relationship("Patient", back_populates="device_pairings")
