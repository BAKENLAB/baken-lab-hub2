-- Run exclusively on disposable service container with fixture schema.
SET ROLE service_role;
DO $test$
DECLARE d date:=(clock_timestamp() at time zone 'Asia/Tokyo')::date;
 tm timestamptz:=date_trunc('minute',clock_timestamp())+interval '40 minutes';
 lv uuid; j uuid; tok uuid; claim jsonb; proof jsonb; runners jsonb; tops jsonb; evidence jsonb; payload jsonb; pred uuid; baseline jsonb; rejected boolean;
 v text:='JRA_JUMP_0.1_K2_20261115'; h text:=repeat('a',64);
BEGIN
 IF (tm at time zone 'Asia/Tokyo')::date<>d THEN RAISE EXCEPTION 'CI fixture crosses Tokyo midnight'; END IF;
 INSERT INTO public.jra_live_races(race_date,track,race_no,race_name,race_type,surface,distance,class_name,field_size,cname,post_time)
 VALUES(d,'福島',5,'障害未勝利','障害','障害',2750,'未勝利',7,'fixture-card',to_char(tm at time zone 'Asia/Tokyo','FMHH24"時"MI"分"')) RETURNING id INTO lv;
 INSERT INTO public.jra_live_runners(live_race_id,horse_no,horse_name,draw,jockey,weight_carried,horse_ref)
 SELECT lv,i,'Fixture '||i,i,'Rider '||i,60,'fixture-horse-'||i FROM generate_series(1,7)i;
 SELECT jsonb_agg(jsonb_build_object('horse_no',i,'horse_name','Fixture '||i,'draw',i,'jockey','Rider '||i,'weight_carried',60,'status','ACTIVE') order by i) INTO runners FROM generate_series(1,7)i;
 proof:=jsonb_build_object('race_date',d,'track','福島','race_no',5,'cname','fixture-card','race_name','障害未勝利','checked_at',clock_timestamp(),'post_time',tm,'html_sha256',h,'html_bytes',1000,'verification_basis','JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1','all_rows_reviewed',true,'race',jsonb_build_object('race_type','障害','surface','障害','distance',2750),'runners',runners);
 rejected:=false;BEGIN PERFORM public.jra_jump_publish_verified_card_v1(proof);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JUMP_PROTOCOL_INACTIVE%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'inactive protocol accepted'; END IF;
 INSERT INTO public.lab_prediction_protocols VALUES('JRA_JUMP',v,true),('JRA_MAIN','flat-fixture',true);
 -- Sentinel prediction rows represent untouched existing JRA and LOCAL.
 INSERT INTO public.official_predictions(race_date,track,race_no,circuit,race_name,post_time,protocol_version,status,predicted_at,frozen_at,payload)
 VALUES(d,'東京',1,'JRA','flat sentinel',tm,'flat-fixture','FROZEN',now(),now(),'{"sentinel":"flat"}'),(d,'名古屋',1,'LOCAL','local sentinel',tm,'local-fixture','FROZEN',now(),now(),'{"sentinel":"local"}');
 SELECT jsonb_agg(to_jsonb(p) order by track) INTO baseline FROM public.official_predictions p;
 rejected:=false;BEGIN PERFORM public.jra_jump_publish_verified_card_v1(jsonb_set(proof,'{race,race_type}','"平地"'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_LIVE_CAPTURE_UNAVAILABLE_OR_MISMATCH%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'flat accepted';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_publish_verified_card_v1(jsonb_set(proof,'{post_time}',to_jsonb(clock_timestamp()-interval '1 minute')));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_VERIFIED_PROOF_INVALID%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'late proof accepted';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_publish_verified_card_v1(jsonb_set(proof,'{runners,0,horse_name}','"incorrect"'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_VERIFIED_HORSE_IDENTITY_MISMATCH%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'identity mismatch accepted';END IF;
 IF public.jra_jump_publish_verified_card_v1(proof)->>'status'<>'BASIC_READY' THEN RAISE EXCEPTION 'READY failed';END IF;
 claim:=public.jra_jump_manual_claim_next_v1();j:=(claim->>'job_id')::uuid;
 IF claim->>'claimed'<>'true' OR claim->>'track'<>'福島' OR (claim->>'race_no')::int<>5 THEN RAISE EXCEPTION 'CLAIM failed';END IF;
 SELECT claim_token INTO tok FROM public.jra_prediction_jobs WHERE id=j;
 IF public.jra_jump_manual_claim_next_v1()->>'job_id'<>j::text THEN RAISE EXCEPTION 'claim resume failed';END IF;
 SELECT jsonb_agg(jsonb_build_object('horse_no',i,'horse_name','Fixture '||i,'rank',i,'score',90-i,'status','ACTIVE','grade','C','reason','Synthetic fixture only','mark',case when i<=5 then (array['◎','○','▲','☆','△'])[i] else null end) order by i),
 jsonb_agg(jsonb_build_object('horse_no',i,'horse_name','Fixture '||i,'rank',i,'score',90-i,'close_refs','[]'::jsonb,'independent_n',0,'independent_j',0) order by i)
 INTO runners,evidence FROM generate_series(1,7)i;
 SELECT jsonb_agg(x.value order by x.i) INTO tops FROM jsonb_array_elements(runners) WITH ORDINALITY x(value,i) WHERE x.i<=5;
 payload:=jsonb_build_object('runners',runners,'top5',tops,'eye',null,'bets','[]'::jsonb,'summary',jsonb_build_object('text','fixture'),'bet_strategy','SUSPENDED_FOR_ABILITY_STABILITY','audit',jsonb_build_object('protocol_version',v,'validated_core','JUMP_K2_RESEARCH_0.1','race_key',replace(d::text,'-','')||'_福島_5R','job_id',j,'all_runners_checked',true,'official_full_field_verified',true,'market_used_for_ranking',false,'market_used_for_eye',false,'target_result_used',false,'rank6_auto_selected',false,'outside_top5_reaudited',true,'official_evidence',jsonb_build_object('html_sha256',h),'score_evidence',evidence,'eye_pool_checked',jsonb_build_array(6,7)));
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,gen_random_uuid(),v,payload);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_SAVE_STALE_CLAIM%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'wrong token accepted';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,tok,v,jsonb_set(payload,'{audit,market_used_for_ranking}','true'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_SAVE_AUDIT_REQUIRED%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'market input accepted';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,tok,v,jsonb_set(payload,'{top5,0,rank}','2'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JUMP_TOP5_EXACT_MATCH%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'rank mutation accepted';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,tok,v,jsonb_set(payload,'{audit,eye_pool_checked}','[]'));EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JUMP_EYE_POOL_COVERAGE%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'missing EYE pool accepted';END IF;
 UPDATE public.official_races SET post_time=clock_timestamp()+interval '2 minutes' WHERE race_date=d AND track='福島' AND race_no=5;
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,tok,v,payload);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_SAVE_RACE_INVALID%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'cutoff accepted';END IF;
 UPDATE public.official_races SET post_time=tm WHERE race_date=d AND track='福島' AND race_no=5;
 pred:=public.jra_jump_save_claimed_prediction_v1(j,tok,v,payload);
 IF NOT EXISTS(SELECT 1 FROM public.official_predictions p WHERE p.id=pred AND p.status='FROZEN' AND p.frozen_at<tm AND p.payload->'bets'='[]') OR NOT EXISTS(SELECT 1 FROM public.jra_prediction_jobs WHERE id=j AND job_status='DONE') OR NOT EXISTS(SELECT 1 FROM public.official_races WHERE race_date=d AND track='福島' AND race_no=5 AND prediction_status='FROZEN') THEN RAISE EXCEPTION 'receipt mismatch';END IF;
 rejected:=false;BEGIN PERFORM public.jra_jump_save_claimed_prediction_v1(j,tok,v,payload);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%JRA_SAVE_STALE_CLAIM%' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'rewrite accepted';END IF;
 IF baseline IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(p) order by track) FROM public.official_predictions p WHERE id<>pred) THEN RAISE EXCEPTION 'sentinels changed';END IF;
 RAISE NOTICE 'PASS SQL READY/CLAIM/FROZEN and inactive, flat, late, identity, token, market, TOP5, EYE, cutoff, duplicate protections + flat/local sentinels';
END $test$;
RESET ROLE;
DO $$BEGIN IF has_function_privilege('anon','public.jra_jump_publish_verified_card_v1(jsonb)','execute') OR has_function_privilege('authenticated','public.jra_jump_manual_claim_next_v1()','execute') OR has_function_privilege('anon','public.jra_jump_save_claimed_prediction_v1(uuid,uuid,text,jsonb)','execute') THEN RAISE EXCEPTION 'public role execute leak';END IF;RAISE NOTICE 'PASS role grants';END$$;
