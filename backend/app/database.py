from datetime import date, datetime
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

DB_PATH = Path(__file__).resolve().parents[2] / "bloodmind.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    blood_group = Column(String(30), nullable=False)
    hospital = Column(String(200), nullable=False)
    city = Column(String(100), default="Hyderabad")
    last_transfusion_date = Column(Date, nullable=True)
    avg_gap_days = Column(Integer, default=21)
    latitude = Column(Float, default=17.39)
    longitude = Column(Float, default=78.46)
    bridge_id = Column(String(128), unique=True, nullable=True)
    medical_notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="patient")
    blood_requests = relationship("BloodRequest", back_populates="patient")


class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    blood_group = Column(String(30), nullable=False)
    city = Column(String(100), default="Hyderabad")
    contact = Column(String(50), nullable=True)
    availability_status = Column(String(20), default="available")
    donation_count = Column(Integer, default=0)
    preferred_language = Column(String(20), default="English")
    preferred_channel = Column(String(20), default="WhatsApp")
    preferred_contact_hour = Column(Integer, default=10)
    preferred_time_period = Column(String(20), default="Morning")
    response_rate = Column(Float, default=0.5)
    latitude = Column(Float, default=17.39)
    longitude = Column(Float, default=78.46)
    user_id = Column(String(128), unique=True, nullable=True)
    last_donation_date = Column(Date, nullable=True)
    next_eligible_date = Column(Date, nullable=True)
    total_donations_completed = Column(Integer, default=0)
    avg_response_hours = Column(Float, default=12.0)
    availability_pattern = Column(Text, default="{}")  # JSON: {"Monday": ["Morning"], ...}
    created_at = Column(DateTime, default=datetime.utcnow)

    match_results = relationship("MatchResult", back_populates="donor")
    notifications = relationship("Notification", back_populates="donor")
    donation_history = relationship("DonorHistory", back_populates="donor")


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    blood_group = Column(String(30), nullable=False)
    quantity = Column(Integer, default=1)
    status = Column(String(20), default="Pending")
    urgency = Column(String(20), default="normal")
    source = Column(String(30), default="manual")
    escalation_round = Column(Integer, default=0)
    required_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="blood_requests")
    match_results = relationship("MatchResult", back_populates="blood_request")
    notifications = relationship("Notification", back_populates="blood_request")
    outreach_history = relationship("OutreachHistory", back_populates="blood_request")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    predicted_date = Column(Date, nullable=False)
    confidence = Column(Float, default=0.9)
    days_until = Column(Integer, default=0)
    auto_request_created = Column(Boolean, default=False)
    blood_request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="predictions")
    blood_request = relationship("BloodRequest", foreign_keys=[blood_request_id])


class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=False)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    score = Column(Float, nullable=False)
    rank = Column(Integer, nullable=False)
    distance_km = Column(Float, default=0)
    status = Column(String(20), default="assigned")
    reasons = Column(Text, default="")
    outreach_round = Column(Integer, default=1)
    scheduled_time = Column(String(100), nullable=True)
    donation_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    blood_request = relationship("BloodRequest", back_populates="match_results")
    donor = relationship("Donor", back_populates="match_results")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=False)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    channel = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="sent")
    donor_response = Column(String(50), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    blood_request = relationship("BloodRequest", back_populates="notifications")
    donor = relationship("Donor", back_populates="notifications")


class OutreachHistory(Base):
    __tablename__ = "outreach_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=False)
    round = Column(Integer, default=1)
    action = Column(String(50), nullable=False)
    details = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    blood_request = relationship("BloodRequest", back_populates="outreach_history")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    role = Column(String(20), default="user")
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    donor = relationship("Donor")


class DonorHistory(Base):
    __tablename__ = "donor_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=True)
    patient_name = Column(String(120), default="")
    blood_group = Column(String(30), default="")
    hospital = Column(String(200), default="")
    city = Column(String(100), default="")
    donation_date = Column(Date, nullable=True)
    time_slot = Column(String(100), default="")
    auto_confirmed = Column(Boolean, default=False)
    response_time_hours = Column(Float, default=0.0)  # how fast they confirmed
    created_at = Column(DateTime, default=datetime.utcnow)

    donor = relationship("Donor", back_populates="donation_history")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_columns()


def _migrate_columns():
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    migrations = [
        ("patients", "medical_notes", "TEXT DEFAULT ''"),
        ("donors", "preferred_time_period", "VARCHAR(20) DEFAULT 'Morning'"),
        ("blood_requests", "required_date", "DATE"),
        ("match_results", "scheduled_time", "VARCHAR(100)"),
        ("match_results", "donation_date", "DATE"),
        ("donors", "last_donation_date", "DATE"),
        ("donors", "next_eligible_date", "DATE"),
        ("donors", "total_donations_completed", "INTEGER DEFAULT 0"),
        ("donors", "avg_response_hours", "REAL DEFAULT 12.0"),
        ("donors", "availability_pattern", "TEXT DEFAULT '{}'"),
    ]
    with engine.connect() as conn:
        for table, col, coltype in migrations:
            if table not in insp.get_table_names():
                continue
            existing = [c["name"] for c in insp.get_columns(table)]
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
        conn.commit()
