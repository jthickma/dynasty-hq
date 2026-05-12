from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Player, PlayerSeasonStat
from app.routers._shared import patch_fields, resolve_pos_group
from app.schemas import PlayerRead, PlayerSeasonStatRead

router = APIRouter(prefix="/dynasties/{dynasty_id}/players", tags=["players"])

_PROTECTED = {"id", "dynasty_id"}


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
        try:
            group = resolve_pos_group(pos_group)
        except ValueError as e:
            raise HTTPException(400, str(e))
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
    patch_fields(p, patch, _PROTECTED)
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


def _require_player(dynasty_id: int, player_id: int, session: Session) -> Player:
    p = session.get(Player, player_id)
    if not p or p.dynasty_id != dynasty_id:
        raise HTTPException(404, "Player not found")
    return p


@router.get("/{player_id}/stats", response_model=list[PlayerSeasonStatRead])
def player_stats(dynasty_id: int, player_id: int, session: Session = Depends(get_session)):
    _require_player(dynasty_id, player_id, session)
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
    _require_player(dynasty_id, player_id, session)
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
    _require_player(dynasty_id, player_id, session)
    stat = session.get(PlayerSeasonStat, stat_id)
    if not stat or stat.player_id != player_id:
        raise HTTPException(404, "Season stat not found")
    patch_fields(stat, patch, {"id", "player_id"})
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
    _require_player(dynasty_id, player_id, session)
    stat = session.get(PlayerSeasonStat, stat_id)
    if not stat or stat.player_id != player_id:
        raise HTTPException(404, "Season stat not found")
    session.delete(stat)
    session.commit()
    return {"ok": True}
