from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Game, Season
from app.schemas import GameRead

router = APIRouter(prefix="/seasons/{season_id}/games", tags=["games"])


@router.get("", response_model=list[GameRead])
def list_games(season_id: int, session: Session = Depends(get_session)):
    stmt = select(Game).where(Game.season_id == season_id).order_by(Game.week)
    return list(session.exec(stmt).all())


@router.post("", response_model=GameRead)
def create_game(season_id: int, game: Game, session: Session = Depends(get_session)):
    if not session.get(Season, season_id):
        raise HTTPException(404, "Season not found")
    game.season_id = season_id
    session.add(game)
    session.commit()
    session.refresh(game)
    return game


@router.patch("/{game_id}", response_model=GameRead)
def update_game(
    season_id: int,
    game_id: int,
    patch: dict,
    session: Session = Depends(get_session),
):
    g = session.get(Game, game_id)
    if not g or g.season_id != season_id:
        raise HTTPException(404, "Game not found")
    for k, v in patch.items():
        if k in {"id", "season_id"} or not hasattr(g, k):
            continue
        setattr(g, k, v)

    if g.team_score is not None and g.opp_score is not None:
        g.played = True
        g.result = "W" if g.team_score > g.opp_score else "L"

    if g.played and g.result:
        season = session.get(Season, season_id)
        if season:
            games = session.exec(
                select(Game).where(Game.season_id == season_id, Game.played == True)  # noqa: E712
            ).all()
            wins = losses = conf_wins = conf_losses = 0
            for x in games:
                is_w = x.result == "W"
                is_l = x.result == "L"
                wins += is_w
                losses += is_l
                if x.is_conference:
                    conf_wins += is_w
                    conf_losses += is_l
            season.wins = wins
            season.losses = losses
            season.conf_wins = conf_wins
            season.conf_losses = conf_losses
            session.add(season)

    session.add(g)
    session.commit()
    session.refresh(g)
    return g


@router.delete("/{game_id}")
def delete_game(season_id: int, game_id: int, session: Session = Depends(get_session)):
    g = session.get(Game, game_id)
    if not g or g.season_id != season_id:
        raise HTTPException(404, "Game not found")
    session.delete(g)
    session.commit()
    return {"ok": True}
