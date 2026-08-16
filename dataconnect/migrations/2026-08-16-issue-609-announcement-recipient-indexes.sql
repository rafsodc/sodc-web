BEGIN;

-- These helpers are parity-checked against announcementRecipients.ts by the
-- Functions contract tests. They are dropped after the one-shot backfill.
CREATE OR REPLACE FUNCTION public.announcement_unicode_trim(input_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT btrim(
    coalesce(input_value, ''),
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
  );
$$;

CREATE OR REPLACE FUNCTION public.announcement_name_fold(input_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  result text := normalize(public.announcement_unicode_trim(input_value), NFKD);
  mapping text[];
  mappings text[][] := ARRAY[
    ARRAY['[Ææ]', 'ae'],
    ARRAY['[ÐðĐđ]', 'd'],
    ARRAY['[Ħħ]', 'h'],
    ARRAY['[ı]', 'i'],
    ARRAY['[Łł]', 'l'],
    ARRAY['[Œœ]', 'oe'],
    ARRAY['[Øø]', 'o'],
    ARRAY['[ßẞ]', 'ss'],
    ARRAY['[Ŧŧ]', 't'],
    ARRAY['[Þþ]', 'th']
  ];
BEGIN
  result := regexp_replace(result, U&'[\0300-\036F]', '', 'g');
  FOREACH mapping SLICE 1 IN ARRAY mappings LOOP
    result := regexp_replace(result, mapping[1], mapping[2], 'g');
  END LOOP;
  RETURN translate(result, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
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
      WHEN token_value ~ '^[0-9]+$' AND length(token_value) < 20
        THEN lpad(token_value, 20, '0')
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
  search_text = public.announcement_unicode_trim(first_name || ' ' || last_name || ' ' || email),
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
DROP FUNCTION public.announcement_unicode_trim(text);

COMMIT;
