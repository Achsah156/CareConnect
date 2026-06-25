"""
The matching engine. This is the part of PathParallel that's actually
novel — not "do a vector search" (that's table stakes for any AI app
today), but the re-ranking layer on top of it.

Plain semantic similarity finds situations with similar *wording*. What
we actually want is situations at a similar *circumstance* — and crucially,
situations with a resolved outcome are more valuable to a searcher than
ones still stuck in the same place they are, because those show what
happens next.

score = (0.5 * similarity) + (0.3 * stage_proximity) + (0.2 * outcome_boost)

Each weight is a tunable constant below — deliberately not hidden inline
in the function, so they're easy to find and adjust once you have real
usage data to tune against.
"""
from sqlalchemy.orm import Session

from app.models.situation import Situation, Stage
from app.services.embeddings import get_embedding_provider
from app.services.vector_store import upsert_situation, query_similar

# Re-ranking weights. Must sum to 1.0.
WEIGHT_SIMILARITY = 0.5
WEIGHT_STAGE_PROXIMITY = 0.3
WEIGHT_OUTCOME_BOOST = 0.2

STAGE_ORDER = [Stage.just_started, Stage.in_it, Stage.turning_point, Stage.resolved]


def _situation_text(situation: Situation) -> str:
    """
    What actually gets embedded. Including situation_type as a prefix
    gives the embedding model explicit context, which helps separate
    "stuck" meaning similarly-worded-but-different-domain situations
    (e.g. "I feel stuck" in a career post vs a relationship post).
    """
    parts = [f"Situation type: {situation.situation_type}", situation.body_text]
    if situation.outcome_text:
        parts.append(f"Outcome: {situation.outcome_text}")
    return "\n".join(parts)


def embed_and_index(situation: Situation) -> None:
    """
    Call this after a situation is created OR after its outcome_text is
    added/changed (re-embedding picks up the new outcome content and
    re-indexes the has_outcome flag for boosting).
    """
    provider = get_embedding_provider()
    embedding = provider.embed(_situation_text(situation))

    upsert_situation(
        situation_id=str(situation.id),
        embedding=embedding,
        metadata={
            "situation_type": situation.situation_type,
            "stage": situation.stage.value,
            "has_outcome": bool(situation.outcome_text),
        },
    )


def _stage_proximity(query_stage: Stage, candidate_stage: Stage) -> float:
    """
    Same stage scores highest, but we deliberately don't penalize being
    *ahead* of the searcher as much as being behind them — someone stuck
    in "in_it" benefits more from seeing a "resolved" story than another
    "in_it" story that's just as stuck as they are.
    """
    query_idx = STAGE_ORDER.index(query_stage)
    candidate_idx = STAGE_ORDER.index(candidate_stage)
    gap = candidate_idx - query_idx  # positive = candidate is further along

    if gap == 0:
        return 1.0
    if gap > 0:
        # Candidate is ahead of the searcher — valuable, decays slowly.
        return max(0.5, 1.0 - 0.2 * gap)
    # Candidate is behind the searcher — less useful, decays faster.
    return max(0.1, 1.0 - 0.4 * abs(gap))


def _outcome_boost(has_outcome: bool) -> float:
    return 1.0 if has_outcome else 0.4


def _distance_to_similarity(distance: float) -> float:
    """
    Chroma returns a distance (lower = more similar) for the default L2
    or cosine-distance space. Convert to a 0-1 similarity score so it
    combines cleanly with the other two factors. Clamped because distance
    can theoretically exceed the naive 0-2 cosine-distance range depending
    on embedding normalization.
    """
    similarity = 1.0 - (distance / 2.0)
    return max(0.0, min(1.0, similarity))


def find_matches(db: Session, situation: Situation, top_k: int = 10) -> list[dict]:
    """
    Returns ranked match dicts: {situation, match_score, similarity,
    stage_proximity, outcome_boost}. Caller (the route) is responsible
    for turning these into the API response shape.
    """
    provider = get_embedding_provider()
    query_embedding = provider.embed(_situation_text(situation))

    candidates = query_similar(
        embedding=query_embedding,
        situation_type=situation.situation_type,
        exclude_id=str(situation.id),
        top_k=top_k * 2,  # over-fetch since re-ranking can reorder significantly
    )

    scored = []
    for candidate in candidates:
        similarity = _distance_to_similarity(candidate["distance"])
        candidate_stage = Stage(candidate["metadata"]["stage"])
        stage_proximity = _stage_proximity(situation.stage, candidate_stage)
        outcome_boost = _outcome_boost(candidate["metadata"]["has_outcome"])

        score = (
            WEIGHT_SIMILARITY * similarity
            + WEIGHT_STAGE_PROXIMITY * stage_proximity
            + WEIGHT_OUTCOME_BOOST * outcome_boost
        )

        scored.append({
            "situation_id": candidate["id"],
            "match_score": score,
            "similarity": similarity,
            "stage_proximity": stage_proximity,
            "outcome_boost": outcome_boost,
        })

    scored.sort(key=lambda s: s["match_score"], reverse=True)
    top_matches = scored[:top_k]

    # Hydrate full Situation rows from Postgres — Chroma only stores the
    # embedding + lightweight metadata, Postgres is the source of truth
    # for the actual content.
    situation_ids = [m["situation_id"] for m in top_matches]
    if not situation_ids:
        return []

    rows = db.query(Situation).filter(Situation.id.in_(situation_ids)).all()
    rows_by_id = {str(row.id): row for row in rows}

    results = []
    for match in top_matches:
        row = rows_by_id.get(match["situation_id"])
        if row is None:
            continue  # situation was deleted after indexing; skip silently
        results.append({**match, "situation": row})

    return results
