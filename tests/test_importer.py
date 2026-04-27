from __future__ import annotations

from sqlmodel import Session, SQLModel, create_engine, select

from app.importer import (
    import_roster,
    import_season_stats,
    parse_roster_csv,
    parse_season_stats_text,
)
from app.models import Dynasty, Player, PlayerSeasonStat

CORE_CSV = """RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV
yes,John Smith,JR (RS),QB,87,78,80,82,79,65,85,,
,M. Johnson,FR,HB,82,91,93,90,88,72,68,86,85
,T.J. O'Neil,SO,WR,85,94,95,89,88,68,74,,
,,SR,DT,80,65,70,60,55,92,75,,
,Jane Unreadable,JR,MLB,78,,85,84,,,77,,"""


EXTENDED_CSV = """RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV,JMP,STA
,Big RB,JR,HB,91,92,94,90,88,82,85,93,92,91,95"""


PREAMBLE_CSV = """Here are your results! To use them with Max's Roster Support, just copy the block below and paste it back into Roster Support

RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV
,Anon,FR,QB,78,75,80,82,79,65,70,,"""


SEASON_STATS_TEXT = """AQUINAS - RUSHING
NAME,POS,GP,CAR,▼YARDS,AVG,TD,AVG G,20+,BTK,YAC,LONG
T.Yancey,HB,2,59,317,5.4,5,158.5,4,8,113,35
L.Davis,QB,2,17,84,4.9,2,42.0,2,4,40,27

AQUINAS - PASSING
NAME,POS,GP,COMP,ATT,COMP%,▼YARDS,TD,TD %,INT,INT %,TD:IN
L.Davis,OB,2,60,80,75%,686,5,6.3,0,0.0,5.0

AQUINAS - RECEIVING
NAME,POS,GP,REC,▼YARDS,AVG,TD,AVG G,LONG,RAC,RAC.AVG,DROP
T.Konz,WR,2,16,176,11.0,1,88.0,20,72,4.5,0
T.Yancey,HB,2,4,39,9.8,0,19.5,13,26,6.5,1

AQUINAS - DEFENSE
NAME,POS,GP,SOLO,ASSISTS,▼TAK,TFL,SACK,INT,INT.YDS,INT.AVG,INT.L
S.DeLuca,SAM,2,11,2,13,1,0.0,0,0,0.0,0
"""


def make_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_parse_handles_rs_flag_and_rs_year():
    rows, warnings = parse_roster_csv(CORE_CSV)
    assert len(rows) == 4  # the blank-name row dropped
    assert rows[0]["rs"] == "yes"
    assert rows[0]["year"] == "JR (RS)"
    assert rows[1]["rs"] is None
    assert rows[1]["year"] == "FR"


def test_parse_preserves_periods_in_names():
    rows, _ = parse_roster_csv(CORE_CSV)
    names = [r["name"] for r in rows]
    assert "M. Johnson" in names
    assert "T.J. O'Neil" in names


def test_parse_leaves_blank_ratings_as_none():
    rows, _ = parse_roster_csv(CORE_CSV)
    unreadable = next(r for r in rows if r["name"] == "Jane Unreadable")
    assert unreadable["spd"] is None
    assert unreadable["acc"] == 85
    assert unreadable["cod"] is None
    assert unreadable["strength"] is None


def test_parse_extended_columns():
    rows, warnings = parse_roster_csv(EXTENDED_CSV)
    assert warnings == []
    assert rows[0]["jmp"] == 91
    assert rows[0]["sta"] == 95


def test_parse_skips_rows_missing_name():
    rows, warnings = parse_roster_csv(CORE_CSV)
    assert any("no NAME" in w for w in warnings)
    assert all(r["name"] for r in rows)


def test_import_roster_creates_players():
    session = make_session()
    dynasty = Dynasty(name="Test", school="OKST")
    session.add(dynasty)
    session.commit()
    session.refresh(dynasty)

    result = import_roster(session, dynasty.id, CORE_CSV)
    assert result.created == 4
    assert result.updated == 0

    players = session.exec(select(Player)).all()
    qb = next(p for p in players if p.pos == "QB")
    assert qb.name == "John Smith"
    assert qb.rs == "yes"
    assert qb.year == "JR (RS)"
    assert qb.ovr == 87
    assert qb.strength == 65  # mapped from STR column


def test_import_roster_updates_without_clobbering():
    session = make_session()
    dynasty = Dynasty(name="Test", school="OKST")
    session.add(dynasty)
    session.commit()
    session.refresh(dynasty)

    import_roster(session, dynasty.id, CORE_CSV)

    # Second import: same player, but with BCV cropped out
    partial = """RS,NAME,YEAR,POS,OVR,SPD,ACC
,John Smith,SR,QB,90,80,82"""
    result = import_roster(session, dynasty.id, partial)
    assert result.updated == 1
    assert result.created == 0

    qb = session.exec(select(Player).where(Player.name == "John Smith")).first()
    assert qb.ovr == 90  # updated
    assert qb.year == "SR"  # updated
    assert qb.awr == 85  # NOT clobbered — still 85 from original import


def test_import_handles_preamble():
    session = make_session()
    dynasty = Dynasty(name="Test", school="OKST")
    session.add(dynasty)
    session.commit()
    session.refresh(dynasty)

    # strip_preamble lives on the router; simulate it here by finding header
    from app.routers.importer import _strip_preamble

    stripped = _strip_preamble(PREAMBLE_CSV)
    assert stripped.startswith("RS,NAME")

    result = import_roster(session, dynasty.id, stripped)
    assert result.created == 1


def test_parse_season_stats_text():
    rows, warnings = parse_season_stats_text(SEASON_STATS_TEXT)
    assert warnings == []
    assert len(rows) == 6

    passer = next(r for r in rows if r["name"] == "L.Davis" and "pass_yds" in r)
    assert passer["pos"] == "QB"
    assert passer["pass_comp"] == 60
    assert passer["pass_pct"] == 75.0
    assert passer["pass_yds"] == 686
    assert passer["pass_td_int_ratio"] == 5.0

    defender = next(r for r in rows if r["name"] == "S.DeLuca")
    assert defender["tackles"] == 13
    assert defender["sacks"] == 0.0


def test_import_season_stats_creates_and_updates_player_stats():
    session = make_session()
    dynasty = Dynasty(name="Test", school="OKST", current_season_year=2026)
    session.add(dynasty)
    session.commit()
    session.refresh(dynasty)

    players = [
        Player(dynasty_id=dynasty.id, name="T.Yancey", pos="HB"),
        Player(dynasty_id=dynasty.id, name="L.Davis", pos="QB"),
        Player(dynasty_id=dynasty.id, name="T.Konz", pos="WR"),
        Player(dynasty_id=dynasty.id, name="S.DeLuca", pos="MLB"),
    ]
    for player in players:
        session.add(player)
    session.commit()

    result = import_season_stats(session, dynasty.id, 2026, SEASON_STATS_TEXT)
    assert result.created == 4
    assert result.updated == 2
    assert result.skipped == 0

    davis = session.exec(select(Player).where(Player.name == "L.Davis")).first()
    davis_stats = session.exec(
        select(PlayerSeasonStat).where(
            PlayerSeasonStat.player_id == davis.id,
            PlayerSeasonStat.season_year == 2026,
        )
    ).first()
    assert davis_stats.games_played == 2
    assert davis_stats.pass_att == 80
    assert davis_stats.pass_yds == 686
    assert davis_stats.rush_att == 17
    assert davis_stats.rush_yds == 84

    yancey = session.exec(select(Player).where(Player.name == "T.Yancey")).first()
    yancey_stats = session.exec(
        select(PlayerSeasonStat).where(
            PlayerSeasonStat.player_id == yancey.id,
            PlayerSeasonStat.season_year == 2026,
        )
    ).first()
    assert yancey_stats.rush_yds == 317
    assert yancey_stats.receptions == 4
    assert yancey_stats.rec_drop == 1

    defender = session.exec(select(Player).where(Player.name == "S.DeLuca")).first()
    defender_stats = session.exec(
        select(PlayerSeasonStat).where(
            PlayerSeasonStat.player_id == defender.id,
            PlayerSeasonStat.season_year == 2026,
        )
    ).first()
    assert defender_stats.solo_tackles == 11
    assert defender_stats.assisted_tackles == 2
    assert defender_stats.tackles == 13
