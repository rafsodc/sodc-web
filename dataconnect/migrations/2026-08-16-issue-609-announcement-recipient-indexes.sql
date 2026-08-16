BEGIN;

-- These helpers deliberately mirror functions/src/announcementRecipients.ts.
-- They are dropped after the one-shot backfill so normal writes continue to
-- calculate immutable query keys in the application.
CREATE OR REPLACE FUNCTION public.announcement_name_fold(input_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  result text := lower(normalize(trim(coalesce(input_value, '')), NFC));
  mapping text[];
  mappings text[][] := ARRAY[
    ARRAY['[àáâãäåāăą]', 'a'],
    ARRAY['[çćč]', 'c'],
    ARRAY['[ďđ]', 'd'],
    ARRAY['[èéêëēėę]', 'e'],
    ARRAY['[ğ]', 'g'],
    ARRAY['[ìíîïīį]', 'i'],
    ARRAY['[ł]', 'l'],
    ARRAY['[ñńň]', 'n'],
    ARRAY['[òóôõöøōő]', 'o'],
    ARRAY['[ř]', 'r'],
    ARRAY['[śšş]', 's'],
    ARRAY['[ť]', 't'],
    ARRAY['[ùúûüūůű]', 'u'],
    ARRAY['[ýÿ]', 'y'],
    ARRAY['[žźż]', 'z']
  ];
BEGIN
  FOREACH mapping SLICE 1 IN ARRAY mappings LOOP
    result := regexp_replace(result, mapping[1], mapping[2], 'g');
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.announcement_natural_sort_key(input_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  folded_value text := public.announcement_name_fold(input_value);
  result text := '';
  token_match text[];
  token_value text;
BEGIN
  FOR token_match IN
    SELECT captures
    FROM regexp_matches(folded_value, '([0-9]+|[^0-9]+)', 'g') AS tokens(captures)
  LOOP
    token_value := token_match[1];
    result := result || CASE
      WHEN token_value ~ '^[0-9]+$' THEN lpad(token_value, 20, '0')
      ELSE token_value
    END;
  END LOOP;
  RETURN result;
END;
$$;

-- Existing history predates the immutable query fields introduced for #609.
UPDATE public.announcement_recipient
SET
  surname_initial = CASE
    WHEN upper(left(public.announcement_name_fold(last_name), 1)) BETWEEN 'A' AND 'Z'
      THEN upper(left(public.announcement_name_fold(last_name), 1))
    ELSE 'OTHER'
  END,
  surname_sort_key = public.announcement_natural_sort_key(last_name),
  first_name_sort_key = public.announcement_natural_sort_key(first_name),
  search_text = trim(first_name || ' ' || last_name || ' ' || email),
  failure_category = CASE
    WHEN status = 'failed' AND failure_reason ~* 'team-only api key'
      THEN 'notify_team_only'
    ELSE 'none'
  END;

DROP INDEX IF EXISTS public.announcement_recipient_history_filter_idx;

-- Default All view: scan one send in the exact normalized display order.
CREATE INDEX IF NOT EXISTS announcement_recipient_history_default_idx
  ON public.announcement_recipient
  (announcement_send_id, surname_sort_key, first_name_sort_key, id);

-- Filtered/status/A-Z views retain their selective columns ahead of display order.
CREATE INDEX IF NOT EXISTS announcement_recipient_history_filter_idx
  ON public.announcement_recipient
  (announcement_send_id, status, failure_category, surname_initial,
   surname_sort_key, first_name_sort_key, id);

DROP FUNCTION public.announcement_natural_sort_key(text);
DROP FUNCTION public.announcement_name_fold(text);

COMMIT;
