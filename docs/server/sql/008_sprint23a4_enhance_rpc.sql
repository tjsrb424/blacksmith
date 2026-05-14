-- Sprint 23-A-4 enhance hot mutation RPC.
-- Run after 001_schema.sql through 007_sprint23a_performance_indexes.sql.
-- The weekly rank estimate uses weekly_rankings_season_category_score_created_idx from 007.

create or replace function public.apply_enhance_action_v1(
  p_user_id uuid,
  p_action_id text,
  p_payload jsonb,
  p_weapon_instance_id uuid,
  p_season_id text,
  p_weapon_definitions jsonb,
  p_rng double precision,
  p_scrap_gold_rng double precision,
  p_scrap_stone_rng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_log record;
  v_action_inserted boolean := false;
  v_row_count bigint := 0;
  v_profile profiles%rowtype;
  v_state player_states%rowtype;
  v_record player_records%rowtype;
  v_weapon owned_weapons%rowtype;
  v_changed_weapon owned_weapons%rowtype;
  v_weapon_def jsonb;
  v_weapon_name text;
  v_base_price bigint;
  v_target_level int;
  v_cost bigint;
  v_success_rate double precision;
  v_is_success boolean;
  v_lose_durability boolean;
  v_next_durability int;
  v_next_ember bigint;
  v_next_gold bigint;
  v_next_stone bigint;
  v_before_value bigint;
  v_after_value bigint;
  v_before_raw_value double precision;
  v_after_raw_value double precision;
  v_before_ranking bigint := 0;
  v_after_ranking bigint := 0;
  v_previous_personal_best bigint;
  v_previous_weekly_best bigint;
  v_records jsonb;
  v_weekly jsonb;
  v_record_patch jsonb;
  v_best_snapshot jsonb := null;
  v_result jsonb;
  v_patch jsonb;
  v_display jsonb;
  v_record_break jsonb := null;
  v_estimated_weekly_rank int := null;
  v_is_personal_best boolean := false;
  v_is_weekly_top100 boolean := false;
  v_entered_weekly_top100 boolean := false;
  v_scrap_gold bigint := 0;
  v_scrap_ember bigint := 0;
  v_scrap_stone bigint := 0;
  v_response jsonb;
begin
  if p_action_id is null or btrim(p_action_id) = '' then
    raise exception 'missing_action_id';
  end if;

  insert into public.game_action_logs(user_id, action_type, action_id, payload, result)
  values (p_user_id, 'enhance', btrim(p_action_id), coalesce(p_payload, '{}'::jsonb), '{"status":"pending"}'::jsonb)
  on conflict (action_id) do nothing;
  get diagnostics v_row_count = row_count;
  v_action_inserted := v_row_count > 0;

  if not v_action_inserted then
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
  end if;

  select * into v_profile
    from public.profiles
    where id = p_user_id;

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

  select value into v_weapon_def
    from jsonb_array_elements(p_weapon_definitions) as defs(value)
    where value->>'id' = v_weapon.weapon_id
    limit 1;
  if v_weapon_def is null then
    raise exception 'weapon_def_not_found';
  end if;

  v_weapon_name := v_weapon_def->>'name';
  v_base_price := (v_weapon_def->>'basePrice')::bigint;
  v_target_level := v_weapon.enhance_level + 1;
  if v_target_level > 15 then
    raise exception 'max_enhance';
  end if;
  if v_weapon.durability <= 0 then
    raise exception 'destroyed_weapon';
  end if;

  v_cost := greatest(
    1,
    round(
      v_base_price *
      case
        when v_target_level between 1 and 3 then 0.045
        when v_target_level between 4 and 6 then 0.075
        when v_target_level between 7 and 9 then 0.13
        when v_target_level between 10 and 12 then 0.21
        else 0.34
      end
    )::bigint
  );
  if v_state.forge_ember < v_cost then
    raise exception 'insufficient_ember';
  end if;

  v_success_rate := case v_target_level
    when 1 then 1.0
    when 2 then 1.0
    when 3 then 0.95
    when 4 then 0.9
    when 5 then 0.85
    when 6 then 0.8
    when 7 then 0.72
    when 8 then 0.58
    when 9 then 0.47
    when 10 then 0.36
    when 11 then 0.29
    when 12 then 0.22
    when 13 then 0.16
    when 14 then 0.1
    when 15 then 0.07
    else 0
  end;
  v_is_success := coalesce(p_rng, 1) < v_success_rate;
  v_next_ember := v_state.forge_ember - v_cost;
  v_next_gold := v_state.gold;
  v_next_stone := v_state.transcend_stone;
  v_previous_personal_best := coalesce(v_record.best_weapon_value, 0);

  v_records := jsonb_build_object(
    'weeklyBestValue', coalesce(v_record.best_weapon_value, 0),
    'totalEnhanceAttempts', coalesce((v_record.stats->>'totalEnhanceAttempts')::bigint, 0) + 1,
    'totalEnhanceSuccesses', coalesce((v_record.stats->>'totalEnhanceSuccesses')::bigint, 0),
    'totalSalesGold', coalesce(v_record.total_sales_gold, 0),
    'bestSaleGold', coalesce(v_record.best_sale_gold, 0),
    'soldWeaponCount', coalesce((v_record.stats->>'soldWeaponCount')::bigint, 0),
    'totalForgeCollected', coalesce((v_record.stats->>'totalForgeCollected')::bigint, 0),
    'totalForgeAdBonusCollected', coalesce((v_record.stats->>'totalForgeAdBonusCollected')::bigint, 0),
    'forgeCollectCount', coalesce((v_record.stats->>'forgeCollectCount')::bigint, 0),
    'forgeAdCollectCount', coalesce((v_record.stats->>'forgeAdCollectCount')::bigint, 0),
    'personalBestRankingValue', coalesce(v_record.best_weapon_value, 0),
    'transcendAttemptCount', coalesce((v_record.stats->>'transcendAttemptCount')::bigint, 0),
    'transcendSuccessCount', coalesce((v_record.stats->>'transcendSuccessCount')::bigint, 0),
    'transcendFailCount', coalesce((v_record.stats->>'transcendFailCount')::bigint, 0),
    'maxTranscendLevel', coalesce(v_record.max_transcend_level, 0),
    'bestTranscendedWeaponValue', coalesce((v_record.stats->>'bestTranscendedWeaponValue')::bigint, 0),
    'transcendDestroyedCount', coalesce((v_record.stats->>'transcendDestroyedCount')::bigint, 0),
    'enhanceFailCount', coalesce((v_record.stats->>'enhanceFailCount')::bigint, 0),
    'enhanceDestroyedCount', coalesce((v_record.stats->>'enhanceDestroyedCount')::bigint, 0),
    'destroyedWeaponCount', coalesce((v_record.stats->>'destroyedWeaponCount')::bigint, 0),
    'maxEnhanceLevel', coalesce(v_record.best_weapon_enhance_level, 0)
  );

  if v_state.stats->'weeklySeasonStats'->>'seasonId' = p_season_id then
    v_weekly := v_state.stats->'weeklySeasonStats';
  else
    v_weekly := jsonb_build_object(
      'seasonId', p_season_id,
      'weeklyStrongestWeaponValue', 0,
      'weeklyStrongestWeaponName', '',
      'weeklyStrongestEnhanceLevel', 0,
      'weeklyStrongestTranscendLevel', 0,
      'enhanceSuccessesThisSeason', 0,
      'transcendSuccessesThisSeason', 0,
      'salesGoldThisSeason', 0
    );
  end if;
  v_previous_weekly_best := coalesce((v_weekly->>'weeklyStrongestWeaponValue')::bigint, 0);

  v_before_raw_value :=
    v_base_price *
    case v_weapon.enhance_level
      when 0 then 0.75 when 1 then 0.95 when 2 then 1.15 when 3 then 1.35
      when 4 then 1.65 when 5 then 2.05 when 6 then 2.5 when 7 then 3.2
      when 8 then 4.0 when 9 then 5.0 when 10 then 6.0 when 11 then 8.0
      when 12 then 10.0 when 13 then 14.0 when 14 then 18.0 else 25.0
    end *
    case v_weapon.transcend_level
      when 0 then 1.0 when 1 then 1.5 when 2 then 2.1 when 3 then 3.0
      when 4 then 4.3 when 5 then 6.2 when 6 then 9.0 when 7 then 13.0
      when 8 then 19.0 when 9 then 28.0 else 45.0
    end *
    case when v_weapon.durability >= 3 then 1.0 when v_weapon.durability = 2 then 0.9 when v_weapon.durability = 1 then 0.75 else 0 end
  ;
  v_before_value := floor(v_before_raw_value)::bigint;
  v_before_ranking := case
    when v_before_raw_value < 100 then round(v_before_raw_value / 10.0) * 10
    when v_before_raw_value < 1000 then round(v_before_raw_value / 50.0) * 50
    when v_before_raw_value < 10000 then round(v_before_raw_value / 100.0) * 100
    when v_before_raw_value < 100000 then round(v_before_raw_value / 500.0) * 500
    else round(v_before_raw_value / 1000.0) * 1000
  end;

  if v_is_success then
    v_after_raw_value :=
      v_base_price *
      case v_target_level
        when 0 then 0.75 when 1 then 0.95 when 2 then 1.15 when 3 then 1.35
        when 4 then 1.65 when 5 then 2.05 when 6 then 2.5 when 7 then 3.2
        when 8 then 4.0 when 9 then 5.0 when 10 then 6.0 when 11 then 8.0
        when 12 then 10.0 when 13 then 14.0 when 14 then 18.0 else 25.0
      end *
      case v_weapon.transcend_level
        when 0 then 1.0 when 1 then 1.5 when 2 then 2.1 when 3 then 3.0
        when 4 then 4.3 when 5 then 6.2 when 6 then 9.0 when 7 then 13.0
        when 8 then 19.0 when 9 then 28.0 else 45.0
      end *
      case when v_weapon.durability >= 3 then 1.0 when v_weapon.durability = 2 then 0.9 when v_weapon.durability = 1 then 0.75 else 0 end
    ;
    v_after_value := floor(v_after_raw_value)::bigint;

    v_after_ranking := case
      when v_after_raw_value < 100 then round(v_after_raw_value / 10.0) * 10
      when v_after_raw_value < 1000 then round(v_after_raw_value / 50.0) * 50
      when v_after_raw_value < 10000 then round(v_after_raw_value / 100.0) * 100
      when v_after_raw_value < 100000 then round(v_after_raw_value / 500.0) * 500
      else round(v_after_raw_value / 1000.0) * 1000
    end;

    v_estimated_weekly_rank := (
      select count(*)::int + 1
      from public.weekly_rankings
      where season_id = p_season_id
        and category = 'weeklyStrongestWeapon'
        and user_id <> p_user_id
        and score > v_after_ranking
    );
    v_is_personal_best := v_after_ranking > v_previous_personal_best;
    v_is_weekly_top100 := v_estimated_weekly_rank <= 100 and v_after_ranking > v_previous_weekly_best;
    v_entered_weekly_top100 := v_is_weekly_top100;

    update public.owned_weapons
      set enhance_level = v_target_level
      where id = v_weapon.id
      returning * into v_changed_weapon;

    v_records := jsonb_set(v_records, '{totalEnhanceSuccesses}', to_jsonb((v_records->>'totalEnhanceSuccesses')::bigint + 1), true);
    v_records := jsonb_set(v_records, '{personalBestRankingValue}', to_jsonb(greatest((v_records->>'personalBestRankingValue')::bigint, v_after_ranking)), true);
    v_records := jsonb_set(v_records, '{weeklyBestValue}', to_jsonb(greatest((v_records->>'weeklyBestValue')::bigint, v_after_ranking)), true);
    v_records := jsonb_set(v_records, '{maxEnhanceLevel}', to_jsonb(greatest((v_records->>'maxEnhanceLevel')::int, v_target_level)), true);

    if v_after_ranking > v_previous_weekly_best then
      v_weekly := jsonb_set(v_weekly, '{weeklyStrongestWeaponValue}', to_jsonb(v_after_ranking), true);
      v_weekly := jsonb_set(v_weekly, '{weeklyStrongestWeaponName}', to_jsonb(v_weapon_name), true);
      v_weekly := jsonb_set(v_weekly, '{weeklyStrongestEnhanceLevel}', to_jsonb(v_target_level), true);
      v_weekly := jsonb_set(v_weekly, '{weeklyStrongestTranscendLevel}', to_jsonb(v_weapon.transcend_level), true);
    end if;
    v_weekly := jsonb_set(v_weekly, '{enhanceSuccessesThisSeason}', to_jsonb(coalesce((v_weekly->>'enhanceSuccessesThisSeason')::bigint, 0) + 1), true);

    if v_is_personal_best then
      v_record_patch := jsonb_build_object(
        'best_weapon_name', v_weapon_name,
        'best_weapon_id', v_weapon.weapon_id,
        'best_weapon_value', v_after_ranking,
        'best_weapon_enhance_level', v_target_level,
        'best_weapon_transcend_level', v_weapon.transcend_level,
        'max_transcend_level', greatest(coalesce(v_record.max_transcend_level, 0), v_weapon.transcend_level),
        'stats', v_records
      );
    else
      v_record_patch := jsonb_build_object('stats', v_records);
    end if;

    if v_after_ranking > v_previous_weekly_best or v_is_personal_best then
      insert into public.weekly_rankings(
        season_id, category, user_id, nickname, weapon_instance_id, weapon_name,
        weapon_id, enhance_level, transcend_level, ranking_value, score
      )
      values (
        p_season_id, 'weeklyStrongestWeapon', p_user_id, v_profile.nickname, v_changed_weapon.id,
        v_weapon_name, v_weapon.weapon_id, v_target_level, v_weapon.transcend_level, v_after_ranking, v_after_ranking
      )
      on conflict (season_id, category, user_id) do update
      set nickname = excluded.nickname,
          weapon_instance_id = excluded.weapon_instance_id,
          weapon_name = excluded.weapon_name,
          weapon_id = excluded.weapon_id,
          enhance_level = excluded.enhance_level,
          transcend_level = excluded.transcend_level,
          ranking_value = excluded.ranking_value,
          score = excluded.score
      where public.weekly_rankings.score < excluded.score;

      insert into public.world_records(
        category, user_id, nickname, weapon_name, weapon_id, enhance_level, transcend_level, value
      )
      values (
        'worldRecordWeapon', p_user_id, v_profile.nickname, v_weapon_name, v_weapon.weapon_id,
        v_target_level, v_weapon.transcend_level, v_after_ranking
      )
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

    v_result := jsonb_build_object(
      'type', 'success',
      'beforeLevel', v_weapon.enhance_level,
      'afterLevel', v_target_level,
      'beforeValue', v_before_value,
      'afterValue', v_after_value
    );
  else
    v_lose_durability := v_target_level >= 8;
    v_next_durability := case when v_lose_durability then v_weapon.durability - 1 else v_weapon.durability end;

    if v_lose_durability and v_next_durability <= 0 then
      v_scrap_gold := greatest(0, round(v_base_price * (0.1 + coalesce(p_scrap_gold_rng, 0) * 0.1))::bigint);
      v_scrap_ember := greatest(0, round(v_base_price * 0.15)::bigint);
      v_scrap_stone := case when coalesce(p_scrap_stone_rng, 1) < 0.12 then 1 else 0 end;
      v_next_gold := v_next_gold + v_scrap_gold;
      v_next_ember := v_next_ember + v_scrap_ember;
      v_next_stone := v_next_stone + v_scrap_stone;

      delete from public.owned_weapons where id = v_weapon.id;
      v_records := jsonb_set(v_records, '{enhanceDestroyedCount}', to_jsonb((v_records->>'enhanceDestroyedCount')::bigint + 1), true);
      v_records := jsonb_set(v_records, '{destroyedWeaponCount}', to_jsonb((v_records->>'destroyedWeaponCount')::bigint + 1), true);

      insert into public.world_records(
        category, user_id, nickname, weapon_name, weapon_id, enhance_level, transcend_level, value
      )
      values (
        'worldRecordDestroyedWeapon', p_user_id, v_profile.nickname, v_weapon_name, v_weapon.weapon_id,
        v_weapon.enhance_level, v_weapon.transcend_level, v_before_ranking
      )
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

      v_changed_weapon := null;
      v_result := jsonb_build_object(
        'type', 'destroyed',
        'level', v_weapon.enhance_level,
        'scrapRewards', jsonb_build_object('gold', v_scrap_gold, 'ember', v_scrap_ember, 'transcendStone', v_scrap_stone),
        'weaponName', v_weapon_name
      );
    else
      update public.owned_weapons
        set durability = greatest(0, least(3, v_next_durability))
        where id = v_weapon.id
        returning * into v_changed_weapon;
      v_records := jsonb_set(v_records, '{enhanceFailCount}', to_jsonb((v_records->>'enhanceFailCount')::bigint + 1), true);
      v_result := jsonb_build_object(
        'type', 'fail',
        'level', v_weapon.enhance_level,
        'beforeDurability', v_weapon.durability,
        'afterDurability', greatest(0, least(3, v_next_durability)),
        'destroyed', false
      );
    end if;
    v_record_patch := jsonb_build_object('stats', v_records);
  end if;

  update public.player_states
    set forge_ember = v_next_ember,
        gold = v_next_gold,
        transcend_stone = v_next_stone,
        stats = coalesce(v_state.stats, '{}'::jsonb) || jsonb_build_object('weeklySeasonStats', v_weekly)
    where id = v_state.id
    returning * into v_state;

  update public.player_records
    set best_weapon_name = coalesce(v_record_patch->>'best_weapon_name', best_weapon_name),
        best_weapon_id = coalesce(v_record_patch->>'best_weapon_id', best_weapon_id),
        best_weapon_value = coalesce((v_record_patch->>'best_weapon_value')::bigint, best_weapon_value),
        best_weapon_enhance_level = coalesce((v_record_patch->>'best_weapon_enhance_level')::int, best_weapon_enhance_level),
        best_weapon_transcend_level = coalesce((v_record_patch->>'best_weapon_transcend_level')::int, best_weapon_transcend_level),
        max_transcend_level = coalesce((v_record_patch->>'max_transcend_level')::int, max_transcend_level),
        stats = v_records
    where id = v_record.id
    returning * into v_record;

  if coalesce(v_record.best_weapon_value, 0) > 0 and v_record.best_weapon_id is not null and v_record.best_weapon_name is not null then
    v_best_snapshot := jsonb_build_object(
      'weaponId', v_record.best_weapon_id,
      'weaponName', v_record.best_weapon_name,
      'enhanceLevel', v_record.best_weapon_enhance_level,
      'transcendLevel', v_record.best_weapon_transcend_level,
      'durability', 3,
      'rankingValue', v_record.best_weapon_value,
      'achievedAt', floor(extract(epoch from v_record.updated_at) * 1000)
    );
  end if;

  if v_is_success and (v_is_personal_best or v_is_weekly_top100) then
    v_record_break := jsonb_build_object(
      'previousBest', v_previous_personal_best,
      'newBest', v_after_ranking,
      'delta', v_after_ranking - v_previous_personal_best,
      'isPersonalBest', v_is_personal_best,
      'isWeeklyTop100', v_is_weekly_top100,
      'estimatedWeeklyRank', case when v_is_weekly_top100 then v_estimated_weekly_rank else null end,
      'newRankingValue', v_after_ranking,
      'previousPersonalBestValue', v_previous_personal_best,
      'rankingDelta', v_after_ranking - v_previous_personal_best,
      'enteredWeeklyTop100', v_entered_weekly_top100,
      'enhancementLevel', v_target_level,
      'shouldPlayRecordBgm', v_target_level >= 12
    );
  end if;

  v_patch := jsonb_build_object(
    'currentGold', v_state.gold,
    'currentEmber', v_state.forge_ember,
    'currentStone', v_state.transcend_stone,
    'records', v_records,
    'weeklySeasonStats', v_weekly,
    'bestWeaponSnapshot', v_best_snapshot
  );

  if v_changed_weapon.id is not null then
    v_patch := v_patch || jsonb_build_object('changedWeapon', to_jsonb(v_changed_weapon));
  else
    v_patch := v_patch || jsonb_build_object('removedWeaponId', v_weapon.id);
  end if;

  v_display := jsonb_build_object(
    'kind', 'enhance',
    'weaponName', v_weapon_name,
    'result', v_result
  );
  if v_record_break is not null then
    v_display := v_display || jsonb_build_object('recordBreak', v_record_break);
  end if;

  v_response := jsonb_build_object(
    'actionId', btrim(p_action_id),
    'actionType', 'enhance',
    'status', 'applied',
    'patch', v_patch,
    'display', v_display
  );

  update public.game_action_logs
    set result = v_response
    where action_id = btrim(p_action_id);

  return v_response;
end;
$$;

revoke all on function public.apply_enhance_action_v1(
  uuid, text, jsonb, uuid, text, jsonb, double precision, double precision, double precision
) from public;
grant execute on function public.apply_enhance_action_v1(
  uuid, text, jsonb, uuid, text, jsonb, double precision, double precision, double precision
) to service_role;
