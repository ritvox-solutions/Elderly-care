from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Index, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.user import GUID

class Reading(Base):
    __tablename__ = "readings"
    __table_args__ = (
        Index("idx_readings_device_ts", "device_id", "timestamp"),
        Index("idx_readings_device_metric_ts", "device_id", "metric", "timestamp"),
        Index("idx_readings_patient_metric_ts", "patient_id", "metric", "timestamp"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(100), index=True, nullable=False)
    patient_id = Column(GUID, ForeignKey("patients.id", ondelete="SET NULL"), nullable=True, index=True)
    sensor_type = Column(String(50), nullable=False)
    metric = Column(String(50), index=True, nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), index=True, nullable=False)
    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    patient = relationship("Patient", back_populates="readings")
