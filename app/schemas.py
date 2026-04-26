"""
Separate read schemas keep relationship fields out of API responses
and avoid SQLModel's table-class serialization quirks.
"""
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


class DynastyRead(SQLModel):
    id: int
    name: str
    school: str
    accent_color: str
    current_season_year: int
    current_week: int
    created_at: datetime


class SeasonRead(SQLModel):
    id: int
    dynasty_id: int
    year: int
    wins: int
    losses: int
    conf_wins: int
    conf_losses: int
    ap_rank: Optional[int] = None
    cfp_rank: Optional[int] = None
    bowl_result: Optional[str] = None
    heisman_winner: Optional[str] = None


class PlayerRead(SQLModel):
    id: int
    dynasty_id: int
    rs: Optional[str] = None
    name: str
    year: Optional[str] = None
    pos: Optional[str] = None
    ovr: Optional[int] = None
    dev_trait: Optional[str] = None
    jersey: Optional[int] = None
    archetype: Optional[str] = None
    # core ratings
    spd: Optional[int] = None
    acc: Optional[int] = None
    agi: Optional[int] = None
    cod: Optional[int] = None
    strength: Optional[int] = None
    awr: Optional[int] = None
    car: Optional[int] = None
    bcv: Optional[int] = None
    # extended ratings
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
    updated_at: datetime


class GameRead(SQLModel):
    id: int
    season_id: int
    week: int
    opponent: str
    opponent_rank: Optional[int] = None
    home_away: str
    is_bye: bool
    is_conference: bool
    played: bool
    team_score: Optional[int] = None
    opp_score: Optional[int] = None
    result: Optional[str] = None
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


class RecruitRead(SQLModel):
    id: int
    dynasty_id: int
    name: str
    pos: str
    stars: int
    state: Optional[str] = None
    national_rank: Optional[int] = None
    position_rank: Optional[int] = None
    school_leader: Optional[str] = None
    interest_level: int
    hours_spent_week: int
    total_hours_spent: int
    committed: bool
    committed_to: Optional[str] = None
    pipeline_bonus: Optional[int] = None
    dealbreakers: Optional[str] = None


class PlayerSeasonStatRead(SQLModel):
    id: int
    player_id: int
    season_year: int
    ovr_start: Optional[int] = None
    ovr_end: Optional[int] = None
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
