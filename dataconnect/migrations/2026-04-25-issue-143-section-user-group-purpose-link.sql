BEGIN;

ALTER TABLE public.section_user_group_purpose_link
  ADD COLUMN IF NOT EXISTS purposes public.section_user_group_purpose[] NULL;

WITH grouped AS (
  SELECT
    section_id,
    user_group_id,
    array_agg(DISTINCT purpose) FILTER (WHERE purpose IS NOT NULL) AS merged_purposes,
    MIN(ctid) AS keep_ctid
  FROM public.section_user_group_purpose_link
  GROUP BY section_id, user_group_id
)
UPDATE public.section_user_group_purpose_link t
SET purposes = g.merged_purposes
FROM grouped g
WHERE t.ctid = g.keep_ctid;

WITH grouped AS (
  SELECT
    section_id,
    user_group_id,
    MIN(ctid) AS keep_ctid
  FROM public.section_user_group_purpose_link
  GROUP BY section_id, user_group_id
)
DELETE FROM public.section_user_group_purpose_link t
USING grouped g
WHERE t.section_id = g.section_id
  AND t.user_group_id = g.user_group_id
  AND t.ctid <> g.keep_ctid;

UPDATE public.section_user_group_purpose_link
SET purposes = ARRAY[purpose]
WHERE purposes IS NULL AND purpose IS NOT NULL;

ALTER TABLE public.section_user_group_purpose_link
  DROP CONSTRAINT IF EXISTS section_user_group_purpose_link_pkey,
  DROP COLUMN IF EXISTS purpose,
  ALTER COLUMN purposes SET NOT NULL,
  ADD PRIMARY KEY (section_id, user_group_id);

COMMIT;
