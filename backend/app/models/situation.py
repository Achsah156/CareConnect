import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Stage(str, enum.Enum):
    just_started = "just_started"
    in_it = "in_it"
    turning_point = "turning_point"
    resolved = "resolved"


class Situation(Base):
    __tablename__ = "situations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    situation_type = Column(String, nullable=False, index=True)
    stage = Column(Enum(Stage), nullable=False, index=True)
    body_text = Column(Text, nullable=False)
    is_anonymous = Column(Boolean, default=False)

    # Filled in once the user resolves their situation. Outcome posts are
    # weighted higher in matching because they show "what happens next."
    outcome_text = Column(Text, nullable=True)

    # ID of the corresponding vector in Chroma. We keep Postgres as the
    # source of truth and Chroma as a derived index, so this can be
    # regenerated if the vector store is ever wiped.
    embedding_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="situations")
    updates = relationship(
        "SituationUpdate", back_populates="situation", order_by="SituationUpdate.created_at"
    )


class SituationUpdate(Base):
    """
    A timeline entry for a situation. Every time a user's stage changes or
    they add a progress note, it's recorded here rather than overwriting
    the parent situation. This is what powers the per-user timeline view
    and gives the matching engine trajectory data, not just a snapshot.
    """
    __tablename__ = "situation_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    situation_id = Column(UUID(as_uuid=True), ForeignKey("situations.id"), nullable=False)
    stage = Column(Enum(Stage), nullable=False)
    body_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    situation = relationship("Situation", back_populates="updates")
