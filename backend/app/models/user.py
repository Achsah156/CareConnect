import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)  # null if Google-only signup
    google_id = Column(String, unique=True, index=True, nullable=True)
    display_name = Column(String, nullable=False)
    is_anonymous_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
