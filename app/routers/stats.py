from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from app.db import get_session
from app.models import Player, PlayerSeasonStat
from app.routers.players import POSITION_GROUPS

router = APIRouter(prefix="/dynasties/{dynasty_id}/stats", tags=["stats"])


@router.get("/leaders/ratings")
def rating_leaders(
    dynasty_id: int,
    limit: int = 10,
    session: Session = Depends(get_session),
) -> dict:
    """Top N players by OVR, also per position group."""
    overall = session.exec(
        select(Player)
        .where(Player.dynasty_id == dynasty_id)
        .order_by(col(Player.ovr).desc().nulls_last())
        .limit(limit)
    ).all()

    by_group: dict[str, list] = {}
    for group, positions in POSITION_GROUPS.items():
        top = session.exec(
            select(Player)
            .where(
                Player.dynasty_id == dynasty_id,
                col(Player.pos).in_(positions),
            )
            .order_by(col(Player.ovr).desc().nulls_last())
            .limit(5)
        ).all()
        by_group[group] = [{"id": p.id, "name": p.name, "pos": p.pos, "ovr": p.ovr} for p in top]

    return {
        "overall": [{"id": p.id, "name": p.name, "pos": p.pos, "ovr": p.ovr} for p in overall],
        "by_position_group": by_group,
    }


@router.get("/leaders/stats")
def stat_leaders(
    dynasty_id: int,
    season_year: int,
    session: Session = Depends(get_session),
) -> dict:
    """Leaders per stat category for a given season."""
    categories = {
        "passing_yards": PlayerSeasonStat.pass_yds,
        "passing_tds": PlayerSeasonStat.pass_td,
        "rushing_yards": PlayerSeasonStat.rush_yds,
        "rushing_tds": PlayerSeasonStat.rush_td,
        "receiving_yards": PlayerSeasonStat.rec_yds,
        "receiving_tds": PlayerSeasonStat.rec_td,
        "receptions": PlayerSeasonStat.receptions,
        "tackles": PlayerSeasonStat.tackles,
        "sacks": PlayerSeasonStat.sacks,
        "interceptions": PlayerSeasonStat.interceptions,
    }

    out: dict[str, list] = {}
    for key, column in categories.items():
        stmt = (
            select(PlayerSeasonStat, Player)
            .join(Player, Player.id == PlayerSeasonStat.player_id)
            .where(
                Player.dynasty_id == dynasty_id,
                PlayerSeasonStat.season_year == season_year,
                col(column).is_not(None),
            )
            .order_by(col(column).desc())
            .limit(5)
        )
        rows = session.exec(stmt).all()
        out[key] = [
            {
                "player_id": p.id,
                "name": p.name,
                "pos": p.pos,
                "value": getattr(s, column.key),
            }
            for s, p in rows
        ]
    return out


@router.get("/roster/summary")
def roster_summary(
    dynasty_id: int,
    session: Session = Depends(get_session),
) -> dict:
    """Counts by position group and class year."""
    all_players = session.exec(
        select(Player).where(Player.dynasty_id == dynasty_id)
    ).all()

    by_group = {g: 0 for g in POSITION_GROUPS}
    by_year = {"FR": 0, "SO": 0, "JR": 0, "SR": 0, "UNK": 0}
    dev_traits = {"Elite": 0, "Star": 0, "Impact": 0, "Normal": 0, "UNK": 0}

    for p in all_players:
        for group, positions in POSITION_GROUPS.items():
            if p.pos in positions:
                by_group[group] += 1
                break
        year_key = (p.year or "UNK").split(" ")[0]
        by_year[year_key if year_key in by_year else "UNK"] += 1
        trait = p.dev_trait or "UNK"
        dev_traits[trait if trait in dev_traits else "UNK"] += 1

    avg_ovr = [p.ovr for p in all_players if p.ovr is not None]
    return {
        "total_players": len(all_players),
        "avg_ovr": round(sum(avg_ovr) / len(avg_ovr), 1) if avg_ovr else 0,
        "by_position_group": by_group,
        "by_year": by_year,
        "by_dev_trait": dev_traits,
    }
