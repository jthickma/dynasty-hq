from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Player, PlayerSeasonStat
from app.schemas import PlayerRead, PlayerSeasonStatRead

router = APIRouter(prefix="/dynasties/{dynasty_id}/players", tags=["players"])

POSITION_GROUPS = {
    "QB": ["QB"],
    "RB": ["HB", "FB", "RB"],
    "WR": ["WR"],
    "TE": ["TE"],
    "OL": ["LT", "LG", "C", "RG", "RT", "OL"],
    "DL": ["LE", "RE", "DT", "DL"],
    "LB": ["LOLB", "MLB", "ROLB", "LB"],
    "DB": ["CB", "FS", "SS", "S", "DB"],
    "ST": ["K", "P", "LS"],
}


@router.get("", response_model=list[PlayerRead])
def list_players(
    dynasty_id: int,
    pos_group: str | None = Query(None, description="QB/RB/WR/TE/OL/DL/LB/DB/ST"),
    pos: str | None = None,
    year: str | None = None,
    min_ovr: int | None = None,
    search: str | None = None,
    session: Session = Depends(get_session),
):
    stmt = select(Player).where(Player.dynasty_id == dynasty_id)
    if pos_group:
        group = POSITION_GROUPS.get(pos_group.upper())
        if not group:
            raise HTTPException(400, f"Unknown position group {pos_group}")
        stmt = stmt.where(col(Player.pos).in_(group))
    if pos:
        stmt = stmt.where(Player.pos == pos)
    if year:
        stmt = stmt.where(col(Player.year).like(f"{year}%"))
    if min_ovr is not None:
        stmt = stmt.where(Player.ovr >= min_ovr)
    if search:
        stmt = stmt.where(col(Player.name).ilike(f"%{search}%"))
    stmt = stmt.order_by(col(Player.ovr).desc().nulls_last())
    return list(session.exec(stmt).all())


@router.get("/{player_id}", response_model=PlayerRead)
def get_player(dynasty_id: int, player_id: int, session: Session = Depends(get_session)):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    return p


@router.patch("/{player_id}", response_model=PlayerRead)
def update_player(
    dynasty_id: int,
    player_id: int,
    patch: dict,
    session: Session = Depends(get_session),
):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    for k, v in patch.items():
        if hasattr(p, k):
            setattr(p, k, v)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.delete("/{player_id}")
def delete_player(dynasty_id: int, player_id: int, session: Session = Depends(get_session)):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


@router.get("/{player_id}/stats", response_model=list[PlayerSeasonStatRead])
def player_stats(dynasty_id: int, player_id: int, session: Session = Depends(get_session)):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    stmt = (
        select(PlayerSeasonStat)
        .where(PlayerSeasonStat.player_id == player_id)
        .order_by(PlayerSeasonStat.season_year)
    )
    return list(session.exec(stmt).all())


@router.post("/{player_id}/stats", response_model=PlayerSeasonStatRead)
def add_player_stat(
    dynasty_id: int,
    player_id: int,
    stat: PlayerSeasonStat,
    session: Session = Depends(get_session),
):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    stat.player_id = player_id
    session.add(stat)
    session.commit()
    session.refresh(stat)
    return stat


@router.patch("/{player_id}/stats/{stat_id}", response_model=PlayerSeasonStatRead)
def update_player_stat(
    dynasty_id: int,
    player_id: int,
    stat_id: int,
    patch: dict,
    session: Session = Depends(get_session),
):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")

    stat = session.get(PlayerSeasonStat, stat_id)
    if not stat or stat.player_id != player_id:
        raise HTTPException(404, "Season stat not found")

    for k, v in patch.items():
        if k not in {"id", "player_id"} and hasattr(stat, k):
            setattr(stat, k, v)
    session.add(stat)
    session.commit()
    session.refresh(stat)
    return stat


@router.delete("/{player_id}/stats/{stat_id}")
def delete_player_stat(
    dynasty_id: int,
    player_id: int,
    stat_id: int,
    session: Session = Depends(get_session),
):
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")

    stat = session.get(PlayerSeasonStat, stat_id)
    if not stat or stat.player_id != player_id:
        raise HTTPException(404, "Season stat not found")

    session.delete(stat)
    session.commit()
    return {"ok": True}
