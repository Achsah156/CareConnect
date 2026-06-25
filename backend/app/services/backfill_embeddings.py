"""
Rebuilds the Chroma vector index from Postgres.

Why this exists: Chroma (in embedded/persisted mode) writes to local disk,
which is NOT durable on most deploy platforms unless you explicitly attach
a persistent volume (Railway/Render free tiers often don't, by default).
Postgres is the real source of truth for situation content; this script
re-derives the vector index from it, so losing the Chroma disk is an
inconvenience, not data loss.

Run manually after a fresh deploy, after wiping chroma_data/, or on a
schedule if you want self-healing in case the two stores ever drift:

    python -m app.services.backfill_embeddings
"""
from app.core.database import SessionLocal
from app.models.situation import Situation
from app.services.matching import embed_and_index


def backfill():
    db = SessionLocal()
    try:
        situations = db.query(Situation).all()
        total = len(situations)
        print(f"Found {total} situations to index.")

        succeeded = 0
        failed = 0
        for i, situation in enumerate(situations, start=1):
            try:
                embed_and_index(situation)
                succeeded += 1
            except Exception as e:
                failed += 1
                print(f"  [{i}/{total}] FAILED situation {situation.id}: {e}")

        print(f"Done. {succeeded} indexed, {failed} failed.")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
