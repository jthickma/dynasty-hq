export interface Dynasty {
  id: number;
  name: string;
  school: string;
  accent_color: string;
  current_season_year: number;
  current_week: number;
  created_at: string;
}

export interface Season {
  id: number;
  dynasty_id: number;
  year: number;
  wins: number;
  losses: number;
  conf_wins: number;
  conf_losses: number;
  ap_rank: number | null;
  cfp_rank: number | null;
  bowl_result: string | null;
  heisman_winner: string | null;
}

export interface Player {
  id: number;
  dynasty_id: number;
  rs: string | null;
  name: string;
  year: string | null;
  pos: string | null;
  ovr: number | null;
  dev_trait: string | null;
  jersey: number | null;
  archetype: string | null;
  spd: number | null;
  acc: number | null;
  agi: number | null;
  cod: number | null;
  strength: number | null;
  awr: number | null;
  car: number | null;
  bcv: number | null;
  jmp: number | null;
  sta: number | null;
  inj: number | null;
  tgh: number | null;
  btk: number | null;
  trk: number | null;
  sfa: number | null;
  jkm: number | null;
  cth: number | null;
  cit: number | null;
  spc: number | null;
  srr: number | null;
  mrr: number | null;
  drr: number | null;
  rls: number | null;
  thp: number | null;
  sac: number | null;
  mac: number | null;
  dac: number | null;
  tup: number | null;
  run: number | null;
  pac: number | null;
  bsk: number | null;
  rbk: number | null;
  pbk: number | null;
  pbp: number | null;
  pbf: number | null;
  rbp: number | null;
  rbf: number | null;
  lbk: number | null;
  ibl: number | null;
  tak: number | null;
  hpw: number | null;
  pur: number | null;
  prc: number | null;
  bsh: number | null;
  pmv: number | null;
  fmv: number | null;
  zcv: number | null;
  mcv: number | null;
  prs: number | null;
  updated_at: string;
}

export interface Game {
  id: number;
  season_id: number;
  week: number;
  opponent: string;
  opponent_rank: number | null;
  home_away: string;
  is_bye: boolean;
  is_conference: boolean;
  played: boolean;
  team_score: number | null;
  opp_score: number | null;
  result: string | null;
  total_yards: number | null;
  opp_total_yards: number | null;
  turnovers: number | null;
  opp_turnovers: number | null;
  third_down_pct: number | null;
  opp_third_down_pct: number | null;
  time_of_possession: string | null;
  q1_team: number | null;
  q2_team: number | null;
  q3_team: number | null;
  q4_team: number | null;
  q1_opp: number | null;
  q2_opp: number | null;
  q3_opp: number | null;
  q4_opp: number | null;
  notes: string | null;
}

export interface Recruit {
  id: number;
  dynasty_id: number;
  name: string;
  pos: string;
  stars: number;
  state: string | null;
  national_rank: number | null;
  position_rank: number | null;
  school_leader: string | null;
  interest_level: number;
  hours_spent_week: number;
  total_hours_spent: number;
  committed: boolean;
  committed_to: string | null;
  pipeline_bonus: number | null;
  dealbreakers: string | null;
}

export interface PlayerSeasonStat {
  id: number;
  player_id: number;
  season_year: number;
  ovr_start: number | null;
  ovr_end: number | null;
  games_played: number | null;
  pass_comp: number | null;
  pass_att: number | null;
  pass_pct: number | null;
  pass_yds: number | null;
  pass_td: number | null;
  pass_td_pct: number | null;
  pass_int: number | null;
  pass_int_pct: number | null;
  pass_td_int_ratio: number | null;
  rush_att: number | null;
  rush_yds: number | null;
  rush_avg: number | null;
  rush_td: number | null;
  rush_yds_per_game: number | null;
  rush_20_plus: number | null;
  rush_broken_tackles: number | null;
  rush_yac: number | null;
  rush_long: number | null;
  receptions: number | null;
  rec_yds: number | null;
  rec_avg: number | null;
  rec_td: number | null;
  rec_yds_per_game: number | null;
  rec_long: number | null;
  rec_rac: number | null;
  rec_rac_avg: number | null;
  rec_drop: number | null;
  solo_tackles: number | null;
  assisted_tackles: number | null;
  tackles: number | null;
  tfl: number | null;
  sacks: number | null;
  interceptions: number | null;
  interception_yards: number | null;
  interception_avg: number | null;
  interception_long: number | null;
  ff: number | null;
  fr: number | null;
}

export interface RosterSummary {
  total_players: number;
  avg_ovr: number;
  by_position_group: Record<string, number>;
  by_year: Record<string, number>;
  by_dev_trait: Record<string, number>;
}

export interface RatingLeaders {
  overall: { id: number; name: string; pos: string | null; ovr: number | null }[];
  by_position_group: Record<
    string,
    { id: number; name: string; pos: string | null; ovr: number | null }[]
  >;
}

export type StatLeaders = Record<
  string,
  { player_id: number; name: string; pos: string | null; value: number | null }[]
>;

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  total_rows: number;
}

export const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "ST"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export interface AppSettings {
  openai_api_key_set: boolean;
  openai_api_key_source: "env" | "db" | "unset";
  openai_vision_model: string;
  openai_vision_model_source: "env" | "db" | "default";
  default_model: string;
}

export interface OpenAIModel {
  id: string;
  created: number | null;
  owned_by: string | null;
  vision: boolean;
}

export interface ImageImportResult extends ImportResult {
  extracted_csv?: string;
  extracted_text?: string;
}

export interface ImageImportDryRun {
  dry_run: true;
  extracted_csv?: string;
  extracted_text?: string;
  rows: unknown[];
  warnings: string[];
  count: number;
}
