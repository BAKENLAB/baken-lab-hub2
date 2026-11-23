CREATE OR REPLACE FUNCTION private.jra_class_level(label text)
 RETURNS smallint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when label is null or btrim(label)='' then null
    when label ~ '(GⅠ|GI|ＧⅠ|G1|Ｇ1)' then 9
    when label ~ '(GⅡ|GII|ＧⅡ|G2|Ｇ2)' then 8
    when label ~ '(GⅢ|GIII|ＧⅢ|G3|Ｇ3)' then 7
    when label ~ '(リステッド|Listed|L)$' then 6
    when label like '%オープン%' then 5
    when label like '%3勝ク%' then 4
    when label like '%2勝ク%' then 3
    when label like '%1勝ク%' then 2
    when label like '%未勝利%' then 1
    when label like '%新馬%' then 1
    else null
  end::smallint;
$function$
