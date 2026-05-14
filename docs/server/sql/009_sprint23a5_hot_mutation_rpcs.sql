-- Sprint 23-A-5 hot mutation RPCs for buy, forge collect, forge upgrade, and sell.
-- Run after 001_schema.sql through 008_sprint23a4_enhance_rpc.sql.

create or replace function public.blacksmith_round_nice_price_v1(p_value double precision)
returns bigint
language sql
immutable
as $$
  select (
    case
      when p_value < 100 then round(p_value / 10.0) * 10
      when p_value < 1000 then round(p_value / 50.0) * 50
      when p_value < 10000 then round(p_value / 100.0) * 100
      when p_value < 100000 then round(p_value / 500.0) * 500
      else round(p_value / 1000.0) * 1000
    end
  )::bigint
$$;

create or replace function public.blacksmith_value_raw_v1(
  p_base_price bigint,
  p_enhance_level int,
  p_transcend_level int,
  p_durability int
)
returns double precision
language sql
immutable
as $$
  select
    p_base_price *
    case greatest(0, least(15, p_enhance_level))
      when 0 then 0.75 when 1 then 0.95 when 2 then 1.15 when 3 then 1.35
      when 4 then 1.65 when 5 then 2.05 when 6 then 2.5 when 7 then 3.2
      when 8 then 4.0 when 9 then 5.0 when 10 then 6.0 when 11 then 8.0
      when 12 then 10.0 when 13 then 14.0 when 14 then 18.0 else 25.0
    end *
    case greatest(0, least(10, p_transcend_level))
      when 0 then 1.0 when 1 then 1.5 when 2 then 2.1 when 3 then 3.0
      when 4 then 4.3 when 5 then 6.2 when 6 then 9.0 when 7 then 13.0
      when 8 then 19.0 when 9 then 28.0 else 45.0
    end *
    case
      when greatest(0, least(3, p_durability)) >= 3 then 1.0
      when greatest(0, least(3, p_durability)) = 2 then 0.9
      when greatest(0, least(3, p_durability)) = 1 then 0.75
      else 0
    end
$$;

create or replace function public.blacksmith_sale_gold_v1(
  p_base_price bigint,
  p_enhance_level int,
  p_transcend_level int,
  p_durability int
)
returns bigint
language sql
immutable
as $$
  select floor(public.blacksmith_value_raw_v1(p_base_price, p_enhance_level, p_transcend_level, p_durability))::bigint
$$;

create or replace function public.blacksmith_ranking_value_v1(
  p_base_price bigint,
  p_enhance_level int,
  p_transcend_level int,
  p_durability int
)
returns bigint
language sql
immutable
as $$
  select public.blacksmith_round_nice_price_v1(
    public.blacksmith_value_raw_v1(p_base_price, p_enhance_level, p_transcend_level, p_durability)
  )
$$;

create or replace function public.blacksmith_records_json_v1(p_record public.player_records)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'weeklyBestValue', coalesce(p_record.best_weapon_value, 0),
    'totalEnhanceAttempts', coalesce((p_record.stats->>'totalEnhanceAttempts')::bigint, 0),
    'totalEnhanceSuccesses', coalesce((p_record.stats->>'totalEnhanceSuccesses')::bigint, 0),
    'totalSalesGold', coalesce(p_record.total_sales_gold, 0),
    'bestSaleGold', coalesce(p_record.best_sale_gold, 0),
    'soldWeaponCount', coalesce((p_record.stats->>'soldWeaponCount')::bigint, 0),
    'totalForgeCollected', coalesce((p_record.stats->>'totalForgeCollected')::bigint, 0),
    'totalForgeAdBonusCollected', coalesce((p_record.stats->>'totalForgeAdBonusCollected')::bigint, 0),
    'forgeCollectCount', coalesce((p_record.stats->>'forgeCollectCount')::bigint, 0),
    'forgeAdCollectCount', coalesce((p_record.stats->>'forgeAdCollectCount')::bigint, 0),
    'personalBestRankingValue', coalesce(p_record.best_weapon_value, 0),
    'transcendAttemptCount', coalesce((p_record.stats->>'transcendAttemptCount')::bigint, 0),
    'transcendSuccessCount', coalesce((p_record.stats->>'transcendSuccessCount')::bigint, 0),
    'transcendFailCount', coalesce((p_record.stats->>'transcendFailCount')::bigint, 0),
    'maxTranscendLevel', coalesce(p_record.max_transcend_level, 0),
    'bestTranscendedWeaponValue', coalesce((p_record.stats->>'bestTranscendedWeaponValue')::bigint, 0),
    'transcendDestroyedCount', coalesce((p_record.stats->>'transcendDestroyedCount')::bigint, 0),
    'enhanceFailCount', coalesce((p_record.stats->>'enhanceFailCount')::bigint, 0),
    'enhanceDestroyedCount', coalesce((p_record.stats->>'enhanceDestroyedCount')::bigint, 0),
    'destroyedWeaponCount', coalesce((p_record.stats->>'destroyedWeaponCount')::bigint, 0),
    'maxEnhanceLevel', coalesce(p_record.best_weapon_enhance_level, 0)
  )
$$;

create or replace function public.blacksmith_weekly_json_v1(
  p_state public.player_states,
  p_season_id text
)
returns jsonb
language sql
stable
as $$
  select case
    when p_state.stats->'weeklySeasonStats'->>'seasonId' = p_season_id then
      jsonb_build_object(
        'seasonId', p_season_id,
        'weeklyStrongestWeaponValue', coalesce((p_state.stats->'weeklySeasonStats'->>'weeklyStrongestWeaponValue')::bigint, 0),
        'weeklyStrongestWeaponName', coalesce(p_state.stats->'weeklySeasonStats'->>'weeklyStrongestWeaponName', ''),
        'weeklyStrongestEnhanceLevel', coalesce((p_state.stats->'weeklySeasonStats'->>'weeklyStrongestEnhanceLevel')::int, 0),
        'weeklyStrongestTranscendLevel', coalesce((p_state.stats->'weeklySeasonStats'->>'weeklyStrongestTranscendLevel')::int, 0),
        'enhanceSuccessesThisSeason', coalesce((p_state.stats->'weeklySeasonStats'->>'enhanceSuccessesThisSeason')::bigint, 0),
        'transcendSuccessesThisSeason', coalesce((p_state.stats->'weeklySeasonStats'->>'transcendSuccessesThisSeason')::bigint, 0),
        'salesGoldThisSeason', coalesce((p_state.stats->'weeklySeasonStats'->>'salesGoldThisSeason')::bigint, 0)
      )
    else
      jsonb_build_object(
        'seasonId', p_season_id,
        'weeklyStrongestWeaponValue', 0,
        'weeklyStrongestWeaponName', '',
        'weeklyStrongestEnhanceLevel', 0,
        'weeklyStrongestTranscendLevel', 0,
        'enhanceSuccessesThisSeason', 0,
        'transcendSuccessesThisSeason', 0,
        'salesGoldThisSeason', 0
      )
    end
$$;

create or replace function public.blacksmith_best_weapon_snapshot_v1(p_record public.player_records)
returns jsonb
language sql
stable
as $$
  select case
    when p_record.best_weapon_id is null or p_record.best_weapon_name is null or coalesce(p_record.best_weapon_value, 0) <= 0 then null::jsonb
    else jsonb_build_object(
      'weaponId', p_record.best_weapon_id,
      'weaponName', p_record.best_weapon_name,
      'enhanceLevel', p_record.best_weapon_enhance_level,
      'transcendLevel', p_record.best_weapon_transcend_level,
      'durability', 3,
      'rankingValue', p_record.best_weapon_value,
      'achievedAt', floor(extract(epoch from p_record.updated_at) * 1000)
    )
  end
$$;

create or replace function public.blacksmith_claim_action_v1(
  p_user_id uuid,
  p_action_type text,
  p_action_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_log record;
  v_row_count bigint := 0;
begin
  if p_action_id is null or btrim(p_action_id) = '' then
    raise exception 'missing_action_id';
  end if;

  insert into public.game_action_logs(user_id, action_type, action_id, payload, result)
  values (p_user_id, p_action_type, btrim(p_action_id), coalesce(p_payload, '{}'::jsonb), '{"status":"pending"}'::jsonb)
  on conflict (action_id) do nothing;
  get diagnostics v_row_count = row_count;

  if v_row_count > 0 then
    return null;
  end if;

  select user_id, result
    into v_existing_log
    from public.game_action_logs
    where action_id = btrim(p_action_id);

  if v_existing_log.user_id is distinct from p_user_id then
    raise exception 'action_conflict';
  end if;

  if v_existing_log.result ? 'actionId' then
    return jsonb_set(v_existing_log.result, '{status}', '"replayed"', true);
  end if;

  raise exception 'action_conflict';
end;
$$;

create or replace function public.blacksmith_complete_action_v1(
  p_action_id text,
  p_response jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.game_action_logs
    set result = p_response
    where action_id = btrim(p_action_id)
$$;

create or replace function public.apply_buy_action_v1(
  p_user_id uuid,
  p_action_id text,
  p_payload jsonb,
  p_weapon_id text,
  p_weapon_definitions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_replay jsonb;
  v_state public.player_states%rowtype;
  v_weapon public.owned_weapons%rowtype;
  v_weapon_def jsonb;
  v_weapon_name text;
  v_base_price bigint;
  v_response jsonb;
begin
  v_replay := public.blacksmith_claim_action_v1(p_user_id, 'buy', p_action_id, p_payload);
  if v_replay is not null then
    return v_replay;
  end if;

  select value into v_weapon_def
    from jsonb_array_elements(p_weapon_definitions) as defs(value)
    where value->>'id' = p_weapon_id
    limit 1;
  if v_weapon_def is null then
    raise exception 'weapon_not_found';
  end if;

  v_weapon_name := v_weapon_def->>'name';
  v_base_price := (v_weapon_def->>'basePrice')::bigint;

  select * into v_state
    from public.player_states
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_state_not_found';
  end if;

  if v_state.gold < v_base_price then
    raise exception 'insufficient_gold';
  end if;

  update public.player_states
    set gold = v_state.gold - v_base_price
    where id = v_state.id
    returning * into v_state;

  insert into public.owned_weapons(user_id, weapon_id, enhance_level, transcend_level, durability, is_locked)
  values (p_user_id, p_weapon_id, 0, 0, 3, false)
  returning * into v_weapon;

  v_response := jsonb_build_object(
    'actionId', btrim(p_action_id),
    'actionType', 'buy',
    'status', 'applied',
    'patch', jsonb_build_object(
      'currentGold', v_state.gold,
      'currentEmber', v_state.forge_ember,
      'currentStone', v_state.transcend_stone,
      'changedWeapon', to_jsonb(v_weapon)
    ),
    'display', jsonb_build_object('kind', 'buy', 'weaponName', v_weapon_name)
  );

  perform public.blacksmith_complete_action_v1(p_action_id, v_response);
  return v_response;
end;
$$;

create or replace function public.apply_forge_collect_action_v1(
  p_user_id uuid,
  p_action_id text,
  p_payload jsonb,
  p_season_id text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_replay jsonb;
  v_state public.player_states%rowtype;
  v_record public.player_records%rowtype;
  v_records jsonb;
  v_used_ad boolean := false;
  v_rate bigint;
  v_max_minutes bigint;
  v_elapsed_seconds double precision;
  v_pending bigint;
  v_gained bigint;
  v_bonus bigint;
  v_response jsonb;
begin
  v_replay := public.blacksmith_claim_action_v1(p_user_id, 'forge_collect', p_action_id, p_payload);
  if v_replay is not null then
    return v_replay;
  end if;

  v_used_ad := coalesce(p_payload->>'collectMode', '') = 'adBonus'
    or coalesce((p_payload->>'adBonusRequested')::boolean, false);

  select * into v_state
    from public.player_states
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_state_not_found';
  end if;

  select * into v_record
    from public.player_records
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_record_not_found';
  end if;

  v_rate := case greatest(1, least(10, v_state.forge_level))
    when 1 then 12 when 2 then 18 when 3 then 26 when 4 then 38 when 5 then 54
    when 6 then 74 when 7 then 102 when 8 then 138 when 9 then 186 else 240
  end;
  v_max_minutes := 120 + (greatest(1, least(10, v_state.forge_level)) - 1) * 6;
  v_elapsed_seconds := greatest(0, extract(epoch from (p_now - v_state.forge_last_collected_at)));
  v_pending := floor(least(v_elapsed_seconds / 60.0, v_max_minutes) * v_rate)::bigint;

  if v_pending <= 0 then
    raise exception 'no_forge_reward';
  end if;

  v_gained := case when v_used_ad then v_pending * 2 else v_pending end;
  v_bonus := case when v_used_ad then v_pending else 0 end;

  v_records := public.blacksmith_records_json_v1(v_record);
  v_records := jsonb_set(v_records, '{totalForgeCollected}', to_jsonb((v_records->>'totalForgeCollected')::bigint + v_gained), true);
  v_records := jsonb_set(v_records, '{totalForgeAdBonusCollected}', to_jsonb((v_records->>'totalForgeAdBonusCollected')::bigint + v_bonus), true);
  v_records := jsonb_set(v_records, '{forgeCollectCount}', to_jsonb((v_records->>'forgeCollectCount')::bigint + 1), true);
  if v_used_ad then
    v_records := jsonb_set(v_records, '{forgeAdCollectCount}', to_jsonb((v_records->>'forgeAdCollectCount')::bigint + 1), true);
  end if;

  update public.player_states
    set forge_ember = v_state.forge_ember + v_gained,
        forge_last_collected_at = p_now
    where id = v_state.id
    returning * into v_state;

  update public.player_records
    set stats = v_records
    where id = v_record.id
    returning * into v_record;

  v_response := jsonb_build_object(
    'actionId', btrim(p_action_id),
    'actionType', 'forge_collect',
    'status', 'applied',
    'patch', jsonb_build_object(
      'currentGold', v_state.gold,
      'currentEmber', v_state.forge_ember,
      'currentStone', v_state.transcend_stone,
      'forgeLastCollectedAt', v_state.forge_last_collected_at,
      'records', public.blacksmith_records_json_v1(v_record)
    ),
    'display', jsonb_build_object(
      'kind', 'forgeCollect',
      'gained', v_gained,
      'basePending', v_pending,
      'usedAd', v_used_ad,
      'bonusAmount', v_bonus
    )
  );

  perform public.blacksmith_complete_action_v1(p_action_id, v_response);
  return v_response;
end;
$$;

create or replace function public.apply_forge_upgrade_action_v1(
  p_user_id uuid,
  p_action_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_replay jsonb;
  v_state public.player_states%rowtype;
  v_current_level int;
  v_new_level int;
  v_cost bigint;
  v_response jsonb;
begin
  v_replay := public.blacksmith_claim_action_v1(p_user_id, 'forge_upgrade', p_action_id, p_payload);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_state
    from public.player_states
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_state_not_found';
  end if;

  v_current_level := v_state.forge_level;
  if v_current_level >= 10 then
    raise exception 'max_forge_level';
  end if;

  v_cost := round(1800 * power(1.75, v_current_level - 1))::bigint;
  if v_state.gold < v_cost then
    raise exception 'insufficient_gold';
  end if;

  v_new_level := v_current_level + 1;
  update public.player_states
    set gold = v_state.gold - v_cost,
        forge_level = v_new_level
    where id = v_state.id
    returning * into v_state;

  v_response := jsonb_build_object(
    'actionId', btrim(p_action_id),
    'actionType', 'forge_upgrade',
    'status', 'applied',
    'patch', jsonb_build_object(
      'currentGold', v_state.gold,
      'currentEmber', v_state.forge_ember,
      'currentStone', v_state.transcend_stone,
      'forgeLevel', v_new_level
    ),
    'display', jsonb_build_object(
      'kind', 'forgeUpgrade',
      'previousLevel', v_current_level,
      'newLevel', v_new_level,
      'costGold', v_cost
    )
  );

  perform public.blacksmith_complete_action_v1(p_action_id, v_response);
  return v_response;
end;
$$;

create or replace function public.apply_sell_action_v1(
  p_user_id uuid,
  p_action_id text,
  p_payload jsonb,
  p_weapon_instance_id uuid,
  p_season_id text,
  p_weapon_definitions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_replay jsonb;
  v_profile public.profiles%rowtype;
  v_state public.player_states%rowtype;
  v_record public.player_records%rowtype;
  v_weapon public.owned_weapons%rowtype;
  v_weapon_count bigint;
  v_weapon_def jsonb;
  v_weapon_name text;
  v_base_price bigint;
  v_base_sale_gold bigint;
  v_bonus_gold bigint := 0;
  v_final_gold bigint;
  v_ranking_value bigint;
  v_previous_best_sale bigint;
  v_weekly jsonb;
  v_records jsonb;
  v_best_snapshot jsonb;
  v_response jsonb;
begin
  v_replay := public.blacksmith_claim_action_v1(p_user_id, 'sell', p_action_id, p_payload);
  if v_replay is not null then
    return v_replay;
  end if;

  if coalesce(p_payload->>'sellMode', '') = 'adBonus'
    or coalesce((p_payload->>'adBonusRequested')::boolean, false) then
    raise exception 'ad_reward_required';
  end if;

  select * into v_state
    from public.player_states
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_state_not_found';
  end if;

  select * into v_record
    from public.player_records
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'player_record_not_found';
  end if;

  select * into v_weapon
    from public.owned_weapons
    where id = p_weapon_instance_id
      and user_id = p_user_id
    for update;
  if not found then
    raise exception 'weapon_not_found';
  end if;

  select count(*)::bigint into v_weapon_count
    from public.owned_weapons
    where user_id = p_user_id;
  if v_weapon_count <= 1 then
    raise exception 'last_weapon_cannot_sell';
  end if;

  if v_weapon.is_locked then
    raise exception 'locked_weapon';
  end if;
  if v_weapon.durability <= 0 then
    raise exception 'destroyed_weapon';
  end if;

  select * into v_profile
    from public.profiles
    where id = p_user_id;

  select value into v_weapon_def
    from jsonb_array_elements(p_weapon_definitions) as defs(value)
    where value->>'id' = v_weapon.weapon_id
    limit 1;
  if v_weapon_def is null then
    raise exception 'weapon_def_not_found';
  end if;

  v_weapon_name := v_weapon_def->>'name';
  v_base_price := (v_weapon_def->>'basePrice')::bigint;
  v_base_sale_gold := public.blacksmith_sale_gold_v1(v_base_price, v_weapon.enhance_level, v_weapon.transcend_level, v_weapon.durability);
  v_final_gold := v_base_sale_gold + v_bonus_gold;
  v_ranking_value := public.blacksmith_ranking_value_v1(v_base_price, v_weapon.enhance_level, v_weapon.transcend_level, v_weapon.durability);
  v_previous_best_sale := coalesce(v_record.best_sale_gold, 0);

  v_weekly := public.blacksmith_weekly_json_v1(v_state, p_season_id);
  v_weekly := jsonb_set(v_weekly, '{salesGoldThisSeason}', to_jsonb((v_weekly->>'salesGoldThisSeason')::bigint + v_final_gold), true);

  v_records := public.blacksmith_records_json_v1(v_record);
  v_records := jsonb_set(v_records, '{totalSalesGold}', to_jsonb((v_records->>'totalSalesGold')::bigint + v_final_gold), true);
  v_records := jsonb_set(v_records, '{bestSaleGold}', to_jsonb(greatest((v_records->>'bestSaleGold')::bigint, v_final_gold)), true);
  v_records := jsonb_set(v_records, '{soldWeaponCount}', to_jsonb((v_records->>'soldWeaponCount')::bigint + 1), true);

  if v_ranking_value > coalesce(v_record.best_weapon_value, 0) then
    v_records := jsonb_set(v_records, '{personalBestRankingValue}', to_jsonb(v_ranking_value), true);
    v_records := jsonb_set(v_records, '{weeklyBestValue}', to_jsonb(greatest((v_records->>'weeklyBestValue')::bigint, v_ranking_value)), true);
    v_records := jsonb_set(v_records, '{maxEnhanceLevel}', to_jsonb(greatest((v_records->>'maxEnhanceLevel')::int, v_weapon.enhance_level)), true);
    v_records := jsonb_set(v_records, '{maxTranscendLevel}', to_jsonb(greatest((v_records->>'maxTranscendLevel')::int, v_weapon.transcend_level)), true);
  end if;

  delete from public.owned_weapons
    where id = v_weapon.id;

  update public.player_states
    set gold = v_state.gold + v_final_gold,
        stats = coalesce(v_state.stats, '{}'::jsonb) || jsonb_build_object('weeklySeasonStats', v_weekly)
    where id = v_state.id
    returning * into v_state;

  update public.player_records
    set best_weapon_name = case when v_ranking_value > coalesce(best_weapon_value, 0) then v_weapon_name else best_weapon_name end,
        best_weapon_id = case when v_ranking_value > coalesce(best_weapon_value, 0) then v_weapon.weapon_id else best_weapon_id end,
        best_weapon_value = greatest(coalesce(best_weapon_value, 0), v_ranking_value),
        best_weapon_enhance_level = case when v_ranking_value > coalesce(best_weapon_value, 0) then v_weapon.enhance_level else best_weapon_enhance_level end,
        best_weapon_transcend_level = case when v_ranking_value > coalesce(best_weapon_value, 0) then v_weapon.transcend_level else best_weapon_transcend_level end,
        max_transcend_level = case when v_ranking_value > coalesce(best_weapon_value, 0) then greatest(coalesce(max_transcend_level, 0), v_weapon.transcend_level) else max_transcend_level end,
        best_sale_gold = greatest(coalesce(best_sale_gold, 0), v_final_gold),
        total_sales_gold = coalesce(total_sales_gold, 0) + v_final_gold,
        stats = v_records
    where id = v_record.id
    returning * into v_record;

  insert into public.weekly_rankings(season_id, category, user_id, nickname, ranking_value, score)
  values (p_season_id, 'weeklySalesKing', p_user_id, v_profile.nickname, (v_weekly->>'salesGoldThisSeason')::bigint, (v_weekly->>'salesGoldThisSeason')::bigint)
  on conflict (season_id, category, user_id) do update
  set nickname = excluded.nickname,
      ranking_value = excluded.ranking_value,
      score = excluded.score;

  if v_base_sale_gold > v_previous_best_sale then
    insert into public.world_records(category, user_id, nickname, weapon_name, weapon_id, enhance_level, transcend_level, value)
    values ('worldRecordSale', p_user_id, v_profile.nickname, v_weapon_name, v_weapon.weapon_id, v_weapon.enhance_level, v_weapon.transcend_level, v_base_sale_gold)
    on conflict (category) do update
    set user_id = excluded.user_id,
        nickname = excluded.nickname,
        weapon_name = excluded.weapon_name,
        weapon_id = excluded.weapon_id,
        enhance_level = excluded.enhance_level,
        transcend_level = excluded.transcend_level,
        value = excluded.value,
        updated_at = now()
    where public.world_records.value < excluded.value;
  end if;

  v_best_snapshot := public.blacksmith_best_weapon_snapshot_v1(v_record);
  v_response := jsonb_build_object(
    'actionId', btrim(p_action_id),
    'actionType', 'sell',
    'status', 'applied',
    'patch', jsonb_build_object(
      'currentGold', v_state.gold,
      'currentEmber', v_state.forge_ember,
      'currentStone', v_state.transcend_stone,
      'removedWeaponId', v_weapon.id,
      'records', public.blacksmith_records_json_v1(v_record),
      'weeklySeasonStats', v_weekly,
      'bestWeaponSnapshot', v_best_snapshot
    ),
    'display', jsonb_build_object(
      'kind', 'sell',
      'rankingValue', v_ranking_value,
      'info', jsonb_build_object(
        'saleType', 'normal',
        'soldWeaponId', v_weapon.id,
        'weaponId', v_weapon.weapon_id,
        'weaponName', v_weapon_name,
        'enhanceLevel', v_weapon.enhance_level,
        'transcendLevel', v_weapon.transcend_level,
        'baseSaleGold', v_base_sale_gold,
        'bonusGold', v_bonus_gold,
        'finalSaleGold', v_final_gold,
        'rankingValue', v_ranking_value,
        'usedAdBonus', false,
        'wasEquipped', false
      )
    )
  );

  perform public.blacksmith_complete_action_v1(p_action_id, v_response);
  return v_response;
end;
$$;

revoke all on function public.blacksmith_round_nice_price_v1(double precision) from public;
revoke all on function public.blacksmith_value_raw_v1(bigint, int, int, int) from public;
revoke all on function public.blacksmith_sale_gold_v1(bigint, int, int, int) from public;
revoke all on function public.blacksmith_ranking_value_v1(bigint, int, int, int) from public;
revoke all on function public.blacksmith_records_json_v1(public.player_records) from public;
revoke all on function public.blacksmith_weekly_json_v1(public.player_states, text) from public;
revoke all on function public.blacksmith_best_weapon_snapshot_v1(public.player_records) from public;
revoke all on function public.blacksmith_claim_action_v1(uuid, text, text, jsonb) from public;
revoke all on function public.blacksmith_complete_action_v1(text, jsonb) from public;

revoke all on function public.apply_buy_action_v1(uuid, text, jsonb, text, jsonb) from public;
grant execute on function public.apply_buy_action_v1(uuid, text, jsonb, text, jsonb) to service_role;

revoke all on function public.apply_forge_collect_action_v1(uuid, text, jsonb, text, timestamptz) from public;
grant execute on function public.apply_forge_collect_action_v1(uuid, text, jsonb, text, timestamptz) to service_role;

revoke all on function public.apply_forge_upgrade_action_v1(uuid, text, jsonb) from public;
grant execute on function public.apply_forge_upgrade_action_v1(uuid, text, jsonb) to service_role;

revoke all on function public.apply_sell_action_v1(uuid, text, jsonb, uuid, text, jsonb) from public;
grant execute on function public.apply_sell_action_v1(uuid, text, jsonb, uuid, text, jsonb) to service_role;
