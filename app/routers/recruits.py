from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Recruit
from app.schemas import RecruitRead

router = APIRouter(prefix="/dynasties/{dynasty_id}/recruits", tags=["recruits"])


@router.get("", response_model=list[RecruitRead])
def list_recruits(
    dynasty_id: int,
    pos: str | None = None,
    committed: bool | None = None,
    min_stars: int | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Recruit).where(Recruit.dynasty_id == dynasty_id)
    if pos:
        stmt = stmt.where(Recruit.pos == pos)
    if committed is not None:
        stmt = stmt.where(Recruit.committed == committed)
    if min_stars is not None:
        stmt = stmt.where(Recruit.stars >= min_stars)
    stmt = stmt.order_by(col(Recruit.interest_level).desc(), col(Recruit.stars).desc())
    return list(session.exec(stmt).all())


@router.post("", response_model=RecruitRead)
def create_recruit(dynasty_id: int, recruit: Recruit, session: Session = Depends(get_session)):
    recruit.dynasty_id = dynasty_id
    session.add(recruit)
    session.commit()
    session.refresh(recruit)
    return recruit


@router.patch("/{recruit_id}", response_model=RecruitRead)
def update_recruit(
    dynasty_id: int,
    recruit_id: int,
    patch: dict,
    session: Session = Depends(get_session),
):
    r = session.get(Recruit, recruit_id)
    if not r or r.dynasty_id != dynasty_id:
        raise HTTPException(404, "Recruit not found")
    for k, v in patch.items():
        if hasattr(r, k):
            setattr(r, k, v)
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


@router.delete("/{recruit_id}")
def delete_recruit(dynasty_id: int, recruit_id: int, session: Session = Depends(get_session)):
    r = session.get(Recruit, recruit_id)
    if not r or r.dynasty_id != dynasty_id:
        raise HTTPException(404, "Recruit not found")
    session.delete(r)
    session.commit()
    return {"ok": True}


@router.get("/budget/weekly")
def weekly_budget(
    dynasty_id: int,
    cap: int = Query(50, description="Weekly hours cap (default 50)"),
    session: Session = Depends(get_session),
):
    stmt = select(Recruit).where(
        Recruit.dynasty_id == dynasty_id,
        Recruit.committed == False,  # noqa: E712
    )
    recruits = list(session.exec(stmt).all())
    used = sum(r.hours_spent_week for r in recruits)
    return {"cap": cap, "used": used, "remaining": max(0, cap - used)}
