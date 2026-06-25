import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.situation import Stage


class SituationCreate(BaseModel):
    situation_type: str = Field(..., min_length=1, max_length=100)
    stage: Stage
    body_text: str = Field(..., min_length=1, max_length=5000)
    is_anonymous: bool = False
    outcome_text: str | None = Field(None, max_length=5000)


class SituationUpdateCreate(BaseModel):
    stage: Stage
    body_text: str = Field(..., min_length=1, max_length=5000)


class SituationUpdateOut(BaseModel):
    id: uuid.UUID
    stage: Stage
    body_text: str
    created_at: datetime

    class Config:
        from_attributes = True


class SituationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    situation_type: str
    stage: Stage
    body_text: str
    is_anonymous: bool
    outcome_text: str | None
    created_at: datetime
    updated_at: datetime
    updates: list[SituationUpdateOut] = []

    class Config:
        from_attributes = True


class MatchedSituationOut(SituationOut):
    """Same as SituationOut but with the match score attached, used only
    in the /matches endpoint response so callers can see why something
    was ranked where it was."""
    match_score: float
    similarity: float
    stage_proximity: float
    outcome_boost: float
