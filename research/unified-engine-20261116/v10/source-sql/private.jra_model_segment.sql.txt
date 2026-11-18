CREATE OR REPLACE FUNCTION private.jra_model_segment(class_name text, race_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when coalesce(class_name,'') like '%新馬%'
      or coalesce(race_name,'') like '%メイクデビュー%' then 'NEW'
    when coalesce(class_name,'') like '%未勝利%' then 'MAIDEN'
    when coalesce(class_name,'') like '%1勝ク%' then 'CLASS1'
    when coalesce(class_name,'') like '%2勝ク%'
      or coalesce(class_name,'') like '%3勝ク%' then 'CLASS2_3'
    when coalesce(class_name,'') like '%オープン%'
      or coalesce(race_name,'') ~ '(GⅠ|GI|ＧⅠ|G1|Ｇ1|GⅡ|GII|ＧⅡ|G2|Ｇ2|GⅢ|GIII|ＧⅢ|G3|Ｇ3|重賞)'
      then 'OPEN_GRADED'
    else 'STANDARD'
  end;
$function$
