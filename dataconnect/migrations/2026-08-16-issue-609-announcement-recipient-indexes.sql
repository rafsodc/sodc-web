BEGIN;

-- Existing history predates the query fields introduced for #609. Backfill
-- surname buckets with the same accent folding used by the application and
-- preserve the known GOV.UK Notify team-only failure classification.
UPDATE public.announcement_recipient
SET surname_initial = CASE
  WHEN trim(last_name) ~* '^[aàáâãäåāăą]' THEN 'A'
  WHEN trim(last_name) ~* '^b' THEN 'B'
  WHEN trim(last_name) ~* '^[cçćč]' THEN 'C'
  WHEN trim(last_name) ~* '^[dďđ]' THEN 'D'
  WHEN trim(last_name) ~* '^[eèéêëēėę]' THEN 'E'
  WHEN trim(last_name) ~* '^f' THEN 'F'
  WHEN trim(last_name) ~* '^[gğ]' THEN 'G'
  WHEN trim(last_name) ~* '^h' THEN 'H'
  WHEN trim(last_name) ~* '^[iìíîïīį]' THEN 'I'
  WHEN trim(last_name) ~* '^j' THEN 'J'
  WHEN trim(last_name) ~* '^k' THEN 'K'
  WHEN trim(last_name) ~* '^[lł]' THEN 'L'
  WHEN trim(last_name) ~* '^m' THEN 'M'
  WHEN trim(last_name) ~* '^[nñńň]' THEN 'N'
  WHEN trim(last_name) ~* '^[oòóôõöøōő]' THEN 'O'
  WHEN trim(last_name) ~* '^p' THEN 'P'
  WHEN trim(last_name) ~* '^q' THEN 'Q'
  WHEN trim(last_name) ~* '^[rř]' THEN 'R'
  WHEN trim(last_name) ~* '^[sśšş]' THEN 'S'
  WHEN trim(last_name) ~* '^[tť]' THEN 'T'
  WHEN trim(last_name) ~* '^[uùúûüūůű]' THEN 'U'
  WHEN trim(last_name) ~* '^v' THEN 'V'
  WHEN trim(last_name) ~* '^w' THEN 'W'
  WHEN trim(last_name) ~* '^x' THEN 'X'
  WHEN trim(last_name) ~* '^[yýÿ]' THEN 'Y'
  WHEN trim(last_name) ~* '^[zžźż]' THEN 'Z'
  ELSE 'OTHER'
END;

UPDATE public.announcement_recipient
SET failure_category = 'notify_team_only'
WHERE failure_reason ~* 'team-only api key';

CREATE INDEX IF NOT EXISTS announcement_recipient_history_filter_idx
  ON public.announcement_recipient
  (announcement_send_id, status, failure_category, surname_initial, last_name, first_name, id);

COMMIT;
