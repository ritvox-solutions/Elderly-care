import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.user import GUID
from models.enums import AlertSeverity, AlertCategory, AlertStatus

class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    patient_id = Column(GUID, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True)
    metric = Column(String(50), nullable=False)
    condition = Column(String(20), nullable=False)
    warning_threshold = Column(Float, nullable=True)
    critical_threshold = Column(Float, nullable=True)
    cooldown_seconds = Column(Integer, default=300, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)

    patient = relationship("Patient", back_populates="alert_rules")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    patient_id = Column(GUID, ForeignKey("patients.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    severity = Column(String(50), nullable=False)
    triggering_metric = Column(String(50), nullable=False)
    triggering_value = Column(Float, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default=AlertStatus.ACTIVE.value, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="alerts")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    notifications = relationship("Notification", back_populates="alert", cascade="all, delete-orphan")
