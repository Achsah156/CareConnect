"""
The personalized feed.

Design choice: this is NOT a global chronological firehose (that's what
Reddit/forums already do badly — too much noise). It's scoped to two
things the user actually cares about:

  1. Situations they're explicitly following (updates on journeys they're
     already invested in)
  2. Situations of the same type as ones they've personally posted (so a
     new "job_search" story shows up for someone navigating their own
     job search, without them having to search for it)

Within that scope, outcome-bearing situations get a recency-decayed boost
so a meaningful 2-week-old resolved story doesn't get buried by a flood
of brand-new just_started posts — but it still decays over time so the
feed doesn't go stale.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.situation import Situation
from app.models.engagement import Follow
from app.schemas.situation import SituationOut

router = APIRouter(prefix="/feed", tags=["feed"])

# How much of a one-time boost a resolved/outcome situation gets, decaying
# linearly to zero over RECENCY_WINDOW_DAYS so old resolved posts don't
# permanently dominate the feed.
OUTCOME_FEED_BOOST = 0.3
RECENCY_WINDOW_DAYS = 30

# Explicit follow is a stronger signal than recency or outcome alone —
# guarantees a followed situation outranks generic discovery content.
FOLLOW_BOOST = 1.0


def _feed_score(situation: Situation, followed_ids: set) -> float:
    age_days = (datetime.utcnow() - situation.created_at).total_seconds() / 86400
    recency_score = max(0.0, 1.0 - (age_days / RECENCY_WINDOW_DAYS))

    outcome_boost = 0.0
    if situation.outcome_text:
        decay = max(0.0, 1.0 - (age_days / RECENCY_WINDOW_DAYS))
        outcome_boost = OUTCOME_FEED_BOOST * decay

    # Following something is an explicit, strong signal — guarantee it
    # ranks above generic recency-only matches, and don't let it decay
    # away just because the post itself is old. A user who follows a
    # situation wants to see it, not have it buried by newer noise.
    follow_boost = FOLLOW_BOOST if situation.id in followed_ids else 0.0

    return recency_score + outcome_boost + follow_boost


@router.get("", response_model=list[SituationOut])
def get_feed(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Situation types the user has personal experience with — used to
    # surface relevant new posts even if they haven't explicitly followed
    # anyone yet (important for a cold-start feed on day one).
    user_situation_types = [
        row[0]
        for row in db.query(Situation.situation_type)
        .filter(Situation.user_id == current_user.id)
        .distinct()
        .all()
    ]

    followed_situation_ids = [
        row[0]
        for row in db.query(Follow.situation_id)
        .filter(Follow.follower_id == current_user.id)
        .all()
    ]
    followed_set = set(followed_situation_ids)

    base_query = db.query(Situation).filter(Situation.user_id != current_user.id)

    # Followed situations are pulled in explicitly and unconditionally —
    # following something is a promise to the user that they'll see it,
    # regardless of how old it is or how the recency-windowed candidate
    # query below would otherwise have ranked it.
    followed_rows = (
        db.query(Situation).filter(Situation.id.in_(followed_situation_ids)).all()
        if followed_situation_ids
        else []
    )

    if user_situation_types:
        # Has posted before — scope general discovery to their own
        # situation types, since that's what's relevant to them.
        other_candidates = (
            base_query.filter(Situation.situation_type.in_(user_situation_types))
            .filter(Situation.id.notin_(followed_situation_ids) if followed_situation_ids else True)
            .order_by(Situation.created_at.desc())
            .limit(limit * 3)
            .all()
        )
    else:
        # No posts of their own (possibly only follows) — blend in
        # general recent activity so the feed isn't just their handful
        # of followed items.
        other_candidates = (
            base_query.filter(Situation.id.notin_(followed_situation_ids) if followed_situation_ids else True)
            .order_by(Situation.created_at.desc())
            .limit(limit * 3)
            .all()
        )

    candidates = followed_rows + other_candidates
    ranked = sorted(candidates, key=lambda s: _feed_score(s, followed_set), reverse=True)
    return ranked[:limit]
