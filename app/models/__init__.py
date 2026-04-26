from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


# ---------- Dynasty / Season ----------

class Dynasty(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    school: str
    accent_color: str = "#FF6B1A"
    current_season_year: int = 2026
    current_week: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    seasons: list["Season"] = Relationship(
        back_populates="dynasty",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    players: list["Player"] = Relationship(
        back_populates="dynasty",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    recruits: list["Recruit"] = Relationship(
        back_populates="dynasty",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Season(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dynasty_id: int = Field(foreign_key="dynasty.id", index=True)
    year: int
    wins: int = 0
    losses: int = 0
    conf_wins: int = 0
    conf_losses: int = 0
    ap_rank: Optional[int] = None
    cfp_rank: Optional[int] = None
    bowl_result: Optional[str] = None
    heisman_winner: Optional[str] = None

    dynasty: Optional[Dynasty] = Relationship(back_populates="seasons")
    games: list["Game"] = Relationship(back_populates="season")


# ---------- Games ----------

class Game(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    season_id: int = Field(foreign_key="season.id", index=True)
    week: int
    opponent: str
    opponent_rank: Optional[int] = None
    home_away: str = Field(default="H")  # H / A / N
    is_bye: bool = False
    is_conference: bool = False

    # result
    played: bool = False
    team_score: Optional[int] = None
    opp_score: Optional[int] = None
    result: Optional[str] = None  # W / L

    # team stats
    total_yards: Optional[int] = None
    opp_total_yards: Optional[int] = None
    turnovers: Optional[int] = None
    opp_turnovers: Optional[int] = None
    third_down_pct: Optional[float] = None
    opp_third_down_pct: Optional[float] = None
    time_of_possession: Optional[str] = None

    q1_team: Optional[int] = None
    q2_team: Optional[int] = None
    q3_team: Optional[int] = None
    q4_team: Optional[int] = None
    q1_opp: Optional[int] = None
    q2_opp: Optional[int] = None
    q3_opp: Optional[int] = None
    q4_opp: Optional[int] = None

    notes: Optional[str] = None

    season: Optional[Season] = Relationship(back_populates="games")


# ---------- Players ----------

class Player(SQLModel, table=True):
    """
    Single row per player. Stats follow MaxPlaysCFB CSV field order.
    All rating columns nullable — only columns visible in the screenshot
    get populated. Unknown ratings stay NULL rather than 0.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    dynasty_id: int = Field(foreign_key="dynasty.id", index=True)

    # core
    rs: Optional[str] = None          # "yes" if active redshirt icon visible
    name: str = Field(index=True)
    year: Optional[str] = None        # FR, SO, JR, SR, with optional (RS) suffix
    pos: Optional[str] = Field(default=None, index=True)
    ovr: Optional[int] = None

    # dev trait / jersey — populated manually, NOT from roster CSV
    dev_trait: Optional[str] = None
    jersey: Optional[int] = None
    archetype: Optional[str] = None

    # Core ratings (always present in MaxPlays CSV)
    spd: Optional[int] = None
    acc: Optional[int] = None
    agi: Optional[int] = None
    cod: Optional[int] = None
    strength: Optional[int] = Field(default=None, alias="str")  # str is reserved
    awr: Optional[int] = None
    car: Optional[int] = None
    bcv: Optional[int] = None

    # Extended ratings (only present if visible in screenshot)
    jmp: Optional[int] = None
    sta: Optional[int] = None
    inj: Optional[int] = None
    tgh: Optional[int] = None
    btk: Optional[int] = None
    trk: Optional[int] = None
    sfa: Optional[int] = None
    jkm: Optional[int] = None
    cth: Optional[int] = None
    cit: Optional[int] = None
    spc: Optional[int] = None
    srr: Optional[int] = None
    mrr: Optional[int] = None
    drr: Optional[int] = None
    rls: Optional[int] = None
    thp: Optional[int] = None
    sac: Optional[int] = None
    mac: Optional[int] = None
    dac: Optional[int] = None
    tup: Optional[int] = None
    run: Optional[int] = None
    pac: Optional[int] = None
    bsk: Optional[int] = None
    rbk: Optional[int] = None
    pbk: Optional[int] = None
    pbp: Optional[int] = None
    pbf: Optional[int] = None
    rbp: Optional[int] = None
    rbf: Optional[int] = None
    lbk: Optional[int] = None
    ibl: Optional[int] = None
    tak: Optional[int] = None
    hpw: Optional[int] = None
    pur: Optional[int] = None
    prc: Optional[int] = None
    bsh: Optional[int] = None
    pmv: Optional[int] = None
    fmv: Optional[int] = None
    zcv: Optional[int] = None
    mcv: Optional[int] = None
    prs: Optional[int] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)

    dynasty: Optional[Dynasty] = Relationship(back_populates="players")
    season_stats: list["PlayerSeasonStat"] = Relationship(back_populates="player")


class PlayerSeasonStat(SQLModel, table=True):
    """Season-by-season progression. Separate from Player so career graphs work."""
    id: Optional[int] = Field(default=None, primary_key=True)
    player_id: int = Field(foreign_key="player.id", index=True)
    season_year: int

    ovr_start: Optional[int] = None
    ovr_end: Optional[int] = None

    # offensive stats
    games_played: Optional[int] = None
    pass_comp: Optional[int] = None
    pass_att: Optional[int] = None
    pass_pct: Optional[float] = None
    pass_yds: Optional[int] = None
    pass_td: Optional[int] = None
    pass_td_pct: Optional[float] = None
    pass_int: Optional[int] = None
    pass_int_pct: Optional[float] = None
    pass_td_int_ratio: Optional[float] = None
    rush_att: Optional[int] = None
    rush_yds: Optional[int] = None
    rush_avg: Optional[float] = None
    rush_td: Optional[int] = None
    rush_yds_per_game: Optional[float] = None
    rush_20_plus: Optional[int] = None
    rush_broken_tackles: Optional[int] = None
    rush_yac: Optional[int] = None
    rush_long: Optional[int] = None
    receptions: Optional[int] = None
    rec_yds: Optional[int] = None
    rec_avg: Optional[float] = None
    rec_td: Optional[int] = None
    rec_yds_per_game: Optional[float] = None
    rec_long: Optional[int] = None
    rec_rac: Optional[int] = None
    rec_rac_avg: Optional[float] = None
    rec_drop: Optional[int] = None

    # defensive stats
    solo_tackles: Optional[int] = None
    assisted_tackles: Optional[int] = None
    tackles: Optional[int] = None
    tfl: Optional[int] = None
    sacks: Optional[float] = None
    interceptions: Optional[int] = None
    interception_yards: Optional[int] = None
    interception_avg: Optional[float] = None
    interception_long: Optional[int] = None
    ff: Optional[int] = None
    fr: Optional[int] = None

    player: Optional[Player] = Relationship(back_populates="season_stats")


# ---------- Recruiting ----------

class Recruit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    dynasty_id: int = Field(foreign_key="dynasty.id", index=True)

    name: str = Field(index=True)
    pos: str
    stars: int = 3
    state: Optional[str] = None
    national_rank: Optional[int] = None
    position_rank: Optional[int] = None

    school_leader: Optional[str] = None
    interest_level: int = 0           # 0-100 for our school
    hours_spent_week: int = 0
    total_hours_spent: int = 0

    committed: bool = False
    committed_to: Optional[str] = None

    pipeline_bonus: Optional[int] = None
    dealbreakers: Optional[str] = None  # JSON-encoded list

    dynasty: Optional[Dynasty] = Relationship(back_populates="recruits")
