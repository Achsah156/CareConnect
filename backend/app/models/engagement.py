import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ReactionType(str, enum.Enum):
    been_there = "been_there"
    rooting_for_you = "rooting_for_you"


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (
        # A user can only react once per type to a given situation
        UniqueConstraint("situation_id", "user_id", "type", name="uq_reaction_once"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    situation_id = Column(UUID(as_uuid=True), ForeignKey("situations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(ReactionType), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "situation_id", name="uq_follow_once"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    situation_id = Column(UUID(as_uuid=True), ForeignKey("situations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
