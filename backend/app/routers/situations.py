import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.situation import Situation, SituationUpdate
from app.models.engagement import Reaction, ReactionType, Follow
from app.schemas.situation import (
    SituationCreate,
    SituationOut,
    SituationUpdateCreate,
    SituationUpdateOut,
    MatchedSituationOut,
)
from app.services.matching import embed_and_index, find_matches

router = APIRouter(prefix="/situations", tags=["situations"])


@router.post("", response_model=SituationOut, status_code=201)
def create_situation(
    payload: SituationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    situation = Situation(
        user_id=current_user.id,
        situation_type=payload.situation_type,
        stage=payload.stage,
        body_text=payload.body_text,
        is_anonymous=payload.is_anonymous,
        outcome_text=payload.outcome_text,
    )
    db.add(situation)
    db.commit()
    db.refresh(situation)

    # Index into the vector store immediately so it's matchable right
    # away. If this raises (e.g. OpenAI hiccup), we deliberately don't
    # let it fail the whole request — the situation is already saved in
    # Postgres, which is the source of truth; it just won't be matchable
    # until a retry/backfill job picks it up. For an MVP demo, a bare
    # try/except is enough; a production version would queue a retry.
    try:
        embed_and_index(situation)
    except Exception:
        pass

    return situation


@router.get("/{situation_id}", response_model=SituationOut)
def get_situation(situation_id: uuid.UUID, db: Session = Depends(get_db)):
    situation = db.query(Situation).filter(Situation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    return situation


@router.post("/{situation_id}/updates", response_model=SituationUpdateOut, status_code=201)
def add_update(
    situation_id: uuid.UUID,
    payload: SituationUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    situation = db.query(Situation).filter(Situation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    if situation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your situation")

    update = SituationUpdate(
        situation_id=situation_id,
        stage=payload.stage,
        body_text=payload.body_text,
    )
    db.add(update)

    # Keep the parent situation's stage in sync with its latest update —
    # this is what the matching engine reads as the "current" stage.
    situation.stage = payload.stage

    db.commit()
    db.refresh(update)

    # Stage changed, so the vector store's metadata is now stale —
    # re-index so future matches use the current stage. Same
    # fail-soft approach as on create: don't block the response on it.
    try:
        embed_and_index(situation)
    except Exception:
        pass

    return update


@router.get("/{situation_id}/matches", response_model=list[MatchedSituationOut])
def get_matches(
    situation_id: uuid.UUID,
    top_k: int = 10,
    db: Session = Depends(get_db),
):
    """
    The core AI feature. Finds situations similar in both meaning and
    journey-stage to this one, prioritizing matches that have a resolved
    outcome — see app/services/matching.py for the full scoring logic.
    """
    situation = db.query(Situation).filter(Situation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")

    matches = find_matches(db, situation, top_k=top_k)

    results = []
    for match in matches:
        matched_situation = match["situation"]
        situation_data = SituationOut.model_validate(matched_situation).model_dump()
        out = MatchedSituationOut(
            **situation_data,
            match_score=match["match_score"],
            similarity=match["similarity"],
            stage_proximity=match["stage_proximity"],
            outcome_boost=match["outcome_boost"],
        )
        results.append(out)

    return results


@router.post("/{situation_id}/react", status_code=201)
def react(
    situation_id: uuid.UUID,
    reaction_type: ReactionType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    situation = db.query(Situation).filter(Situation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")

    existing = (
        db.query(Reaction)
        .filter(
            Reaction.situation_id == situation_id,
            Reaction.user_id == current_user.id,
            Reaction.type == reaction_type,
        )
        .first()
    )
    if existing:
        return {"detail": "Already reacted"}

    reaction = Reaction(situation_id=situation_id, user_id=current_user.id, type=reaction_type)
    db.add(reaction)
    db.commit()
    return {"detail": "Reaction added"}


@router.post("/{situation_id}/follow", status_code=201)
def follow_situation(
    situation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    situation = db.query(Situation).filter(Situation.id == situation_id).first()
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")

    existing = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.id, Follow.situation_id == situation_id)
        .first()
    )
    if existing:
        return {"detail": "Already following"}

    follow = Follow(follower_id=current_user.id, situation_id=situation_id)
    db.add(follow)
    db.commit()
    return {"detail": "Following"}


@router.delete("/{situation_id}/follow", status_code=200)
def unfollow_situation(
    situation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follow = (
        db.query(Follow)
        .filter(Follow.follower_id == current_user.id, Follow.situation_id == situation_id)
        .first()
    )
    if not follow:
        return {"detail": "Not following"}

    db.delete(follow)
    db.commit()
    return {"detail": "Unfollowed"}
