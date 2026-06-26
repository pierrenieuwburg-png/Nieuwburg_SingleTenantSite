"""
P0-3 double-booking smoke test (Postgres).

Two providers concurrently accept their own LeadDispatch row for the SAME job.
Correct behaviour: exactly ONE caller reaches the success ("you won") path.

- FIXED mode replicates the shipped accept_lead transaction (routes/api.py):
  fetch dispatch (no lock) -> SELECT job ... FOR UPDATE -> guard on
  job.tenant_id / job.status == 'Searching' -> mark won / batch-lose / claim job.
- CONTROL mode replays the OLD logic (no job lock; unlocked 'won' winner check)
  to prove the harness actually reproduces the race.

A threading.Barrier releases both workers at the same instant to maximise
contention right before the lock.

Requires a Postgres DATABASE_URL (the SQLite global write lock hides the race).
Run from the repo root, e.g.:

    .venv\\Scripts\\python.exe -m tests.p0_3_concurrency_smoke

Last result (2026-06-27, Supabase Postgres): FIXED 30/30 exactly one winner;
CONTROL reproduced the double-win once in 30 runs. VERDICT: PASS.
"""
import threading
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from nieuwburg import create_app, db
from nieuwburg.models import Tenant, User, Job, LeadDispatch

app = create_app()
ITERATIONS = 30


def attempt_fixed(engine, dispatch_id, tenant_id, barrier, results, idx):
    """Mirror of the shipped accept_lead transaction."""
    s = Session(bind=engine)
    try:
        dispatch = s.query(LeadDispatch).filter_by(id=dispatch_id, tenant_id=tenant_id).first()
        if dispatch.status != 'pending' or datetime.utcnow() > dispatch.expires_at:
            results[idx] = 'expired'; return
        barrier.wait()  # both workers hit the lock together
        job = s.query(Job).filter_by(id=dispatch.job_id).with_for_update().first()
        if job is None:
            results[idx] = 'no_job'; return
        if job.tenant_id is not None or job.status != 'Searching':
            dispatch.status = 'lost'
            s.commit()
            results[idx] = 'lost'; return
        # success path ("you won")
        dispatch.status = 'won'
        s.query(LeadDispatch).filter(
            LeadDispatch.job_id == dispatch.job_id,
            LeadDispatch.id != dispatch.id,
        ).update({"status": "lost"})
        job.tenant_id = tenant_id
        job.status = 'Matched - Awaiting Payment'
        s.commit()
        results[idx] = 'won'
    except Exception as e:
        s.rollback()
        results[idx] = f'error:{type(e).__name__}'
    finally:
        s.close()


def attempt_buggy(engine, dispatch_id, tenant_id, barrier, results, idx):
    """OLD logic: no FOR UPDATE on the job; unlocked 'won' winner check."""
    s = Session(bind=engine)
    try:
        dispatch = s.query(LeadDispatch).filter_by(id=dispatch_id, tenant_id=tenant_id).first()
        if dispatch.status != 'pending' or datetime.utcnow() > dispatch.expires_at:
            results[idx] = 'expired'; return
        barrier.wait()
        existing_winner = s.query(LeadDispatch).filter_by(job_id=dispatch.job_id, status='won').first()
        if existing_winner:
            dispatch.status = 'lost'
            s.commit()
            results[idx] = 'lost'; return
        # success path ("you won")
        dispatch.status = 'won'
        s.query(LeadDispatch).filter(
            LeadDispatch.job_id == dispatch.job_id,
            LeadDispatch.id != dispatch.id,
        ).update({"status": "lost"})
        job = s.query(Job).filter_by(id=dispatch.job_id).first()
        job.tenant_id = tenant_id
        job.status = 'Matched - Awaiting Payment'
        s.commit()
        results[idx] = 'won'
    except Exception as e:
        s.rollback()
        results[idx] = f'error:{type(e).__name__}'
    finally:
        s.close()


def run_mode(name, worker, engine, job_id, da_id, db_id, ta_id, tb_id):
    winner_counts = {}
    for _ in range(ITERATIONS):
        # reset state for this round
        reset = Session(bind=engine)
        job = reset.query(Job).filter_by(id=job_id).first()
        job.tenant_id = None
        job.status = 'Searching'
        for d in reset.query(LeadDispatch).filter(LeadDispatch.job_id == job_id):
            d.status = 'pending'
            d.expires_at = datetime.utcnow() + timedelta(minutes=5)
        reset.commit()
        reset.close()

        barrier = threading.Barrier(2)
        results = [None, None]
        t1 = threading.Thread(target=worker, args=(engine, da_id, ta_id, barrier, results, 0))
        t2 = threading.Thread(target=worker, args=(engine, db_id, tb_id, barrier, results, 1))
        t1.start(); t2.start(); t1.join(); t2.join()

        wins = results.count('won')
        winner_counts[wins] = winner_counts.get(wins, 0) + 1
    print(f"[{name}] winner-count distribution over {ITERATIONS} runs: {dict(sorted(winner_counts.items()))}")
    return winner_counts


def main():
    with app.app_context():
        engine = db.engine
        setup = Session(bind=engine)
        # any existing user works as the job's client FK
        client = setup.query(User).first()
        if client is None:
            raise SystemExit("No user in DB; run seed.py first.")
        ta = Tenant(business_name='P0-3 Test A', subscription_plan='test', is_active=True)
        tb = Tenant(business_name='P0-3 Test B', subscription_plan='test', is_active=True)
        setup.add_all([ta, tb]); setup.flush()
        job = Job(scheduled_date=datetime.utcnow().date(), status='Searching',
                  client_id=client.id, tenant_id=None)
        setup.add(job); setup.flush()
        da = LeadDispatch(job_id=job.id, tenant_id=ta.id, status='pending',
                          expires_at=datetime.utcnow() + timedelta(minutes=5))
        dbd = LeadDispatch(job_id=job.id, tenant_id=tb.id, status='pending',
                           expires_at=datetime.utcnow() + timedelta(minutes=5))
        setup.add_all([da, dbd]); setup.commit()
        job_id, da_id, db_id, ta_id, tb_id = job.id, da.id, dbd.id, ta.id, tb.id
        setup.close()

        print("=== P0-3 concurrency smoke test (Postgres) ===")
        print("Expectation: FIXED -> always exactly 1 winner; CONTROL -> sometimes 2 (race).")
        ctrl = run_mode("CONTROL (old, no job lock)", attempt_buggy, engine, job_id, da_id, db_id, ta_id, tb_id)
        fixed = run_mode("FIXED (job FOR UPDATE)", attempt_fixed, engine, job_id, da_id, db_id, ta_id, tb_id)

        # cleanup
        cleanup = Session(bind=engine)
        cleanup.query(LeadDispatch).filter(LeadDispatch.job_id == job_id).delete()
        cleanup.query(Job).filter_by(id=job_id).delete()
        cleanup.query(Tenant).filter(Tenant.id.in_([ta_id, tb_id])).delete(synchronize_session=False)
        cleanup.commit(); cleanup.close()
        print("cleanup: test rows removed")

        print()
        fixed_ok = set(fixed.keys()) == {1}
        race_seen = ctrl.get(2, 0) > 0
        print(f"RESULT: FIXED always-exactly-one-winner = {fixed_ok}")
        print(f"RESULT: CONTROL reproduced the race (>=1 double-win) = {race_seen}")
        print("VERDICT:", "PASS" if fixed_ok else "FAIL")


if __name__ == '__main__':
    main()
