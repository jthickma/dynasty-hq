from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Dynasty, Season
from app.schemas import DynastyRead, SeasonRead

router = APIRouter(prefix="/dynasties", tags=["dynasty"])


@router.post("", response_model=DynastyRead)
def create_dynasty(dynasty: Dynasty, session: Session = Depends(get_session)):
    session.add(dynasty)
    session.commit()
    session.refresh(dynasty)
    season = Season(dynasty_id=dynasty.id, year=dynasty.current_season_year)
    session.add(season)
    session.commit()
    return dynasty


@router.get("", response_model=list[DynastyRead])
def list_dynasties(session: Session = Depends(get_session)):
    return list(session.exec(select(Dynasty)).all())


@router.get("/{dynasty_id}", response_model=DynastyRead)
def get_dynasty(dynasty_id: int, session: Session = Depends(get_session)):
    d = session.get(Dynasty, dynasty_id)
    if not d:
        raise HTTPException(404, "Dynasty not found")
    return d


_DYNASTY_PROTECTED = {"id", "created_at"}


@router.patch("/{dynasty_id}", response_model=DynastyRead)
def update_dynasty(dynasty_id: int, patch: dict, session: Session = Depends(get_session)):
    d = session.get(Dynasty, dynasty_id)
    if not d:
        raise HTTPException(404, "Dynasty not found")
    for k, v in patch.items():
        if k in _DYNASTY_PROTECTED or not hasattr(d, k):
            continue
        setattr(d, k, v)
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.delete("/{dynasty_id}")
def delete_dynasty(dynasty_id: int, session: Session = Depends(get_session)) -> dict:
    d = session.get(Dynasty, dynasty_id)
    if not d:
        raise HTTPException(404, "Dynasty not found")
    session.delete(d)
    session.commit()
    return {"ok": True}


@router.get("/{dynasty_id}/seasons", response_model=list[SeasonRead])
def list_seasons(dynasty_id: int, session: Session = Depends(get_session)):
    stmt = select(Season).where(Season.dynasty_id == dynasty_id).order_by(Season.year)
    return list(session.exec(stmt).all())


@router.post("/{dynasty_id}/seasons", response_model=SeasonRead)
def create_season(dynasty_id: int, season: Season, session: Session = Depends(get_session)):
    season.dynasty_id = dynasty_id
    session.add(season)
    session.commit()
    session.refresh(season)
    return season
