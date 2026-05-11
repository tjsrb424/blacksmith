export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerStateRow = {
  id: string;
  user_id: string;
  gold: number;
  forge_ember: number;
  transcend_stone: number;
  forge_level: number;
  forge_last_collected_at: string;
  current_season_id: string;
  stats: Json;
  created_at: string;
  updated_at: string;
};

export type OwnedWeaponRow = {
  id: string;
  user_id: string;
  weapon_id: string;
  enhance_level: number;
  transcend_level: number;
  durability: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type PlayerRecordRow = {
  id: string;
  user_id: string;
  best_weapon_name: string | null;
  best_weapon_id: string | null;
  best_weapon_value: number;
  best_weapon_enhance_level: number;
  best_weapon_transcend_level: number;
  best_sale_gold: number;
  total_sales_gold: number;
  max_transcend_level: number;
  stats: Json;
  created_at: string;
  updated_at: string;
};

export type GameActionLogRow = {
  id: string;
  user_id: string;
  action_type: string;
  action_id: string;
  payload: Json;
  result: Json;
  created_at: string;
};

export type WeeklyRankingRow = {
  id: string;
  season_id: string;
  category: string;
  user_id: string;
  nickname: string | null;
  weapon_instance_id: string | null;
  weapon_name: string | null;
  weapon_id: string | null;
  enhance_level: number;
  transcend_level: number;
  ranking_value: number;
  score: number;
  created_at: string;
};

export type WorldRecordRow = {
  id: string;
  category: string;
  user_id: string;
  nickname: string | null;
  weapon_name: string | null;
  weapon_id: string | null;
  enhance_level: number;
  transcend_level: number;
  value: number;
  created_at: string;
  updated_at: string;
};

export type AdRewardLogRow = {
  id: string;
  user_id: string;
  reward_type: string;
  reward_status: string;
  provider: string;
  provider_reward_id: string | null;
  action_id: string;
  related_action_id: string | null;
  payload: Json;
  reward_result: Json | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        {
          id: string;
          nickname?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          nickname?: string | null;
          updated_at?: string;
        }
      >;
      player_states: Table<
        PlayerStateRow,
        {
          id?: string;
          user_id: string;
          gold?: number;
          forge_ember?: number;
          transcend_stone?: number;
          forge_level?: number;
          forge_last_collected_at?: string;
          current_season_id?: string;
          stats?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      owned_weapons: Table<
        OwnedWeaponRow,
        {
          id?: string;
          user_id: string;
          weapon_id: string;
          enhance_level?: number;
          transcend_level?: number;
          durability?: number;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      player_records: Table<
        PlayerRecordRow,
        {
          id?: string;
          user_id: string;
          best_weapon_name?: string | null;
          best_weapon_id?: string | null;
          best_weapon_value?: number;
          best_weapon_enhance_level?: number;
          best_weapon_transcend_level?: number;
          best_sale_gold?: number;
          total_sales_gold?: number;
          max_transcend_level?: number;
          stats?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      game_action_logs: Table<
        GameActionLogRow,
        {
          id?: string;
          user_id: string;
          action_type: string;
          action_id: string;
          payload?: Json;
          result?: Json;
          created_at?: string;
        }
      >;
      weekly_rankings: Table<
        WeeklyRankingRow,
        {
          id?: string;
          season_id: string;
          category: string;
          user_id: string;
          nickname?: string | null;
          weapon_instance_id?: string | null;
          weapon_name?: string | null;
          weapon_id?: string | null;
          enhance_level?: number;
          transcend_level?: number;
          ranking_value?: number;
          score?: number;
          created_at?: string;
        }
      >;
      world_records: Table<
        WorldRecordRow,
        {
          id?: string;
          category: string;
          user_id: string;
          nickname?: string | null;
          weapon_name?: string | null;
          weapon_id?: string | null;
          enhance_level?: number;
          transcend_level?: number;
          value?: number;
          created_at?: string;
          updated_at?: string;
        }
      >;
      ad_reward_logs: Table<
        AdRewardLogRow,
        {
          id?: string;
          user_id: string;
          reward_type: string;
          reward_status: string;
          provider: string;
          provider_reward_id?: string | null;
          action_id: string;
          related_action_id?: string | null;
          payload?: Json;
          reward_result?: Json | null;
          requested_at?: string;
          completed_at?: string | null;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          reward_status?: string;
          provider_reward_id?: string | null;
          reward_result?: Json | null;
          completed_at?: string | null;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
