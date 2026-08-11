BEGIN;

-- Issue #543 makes the guest approval limit mandatory. Backfill legacy/test
-- rows fail-closed: 0 means every booking containing a guest needs approval.
UPDATE public.event
SET max_guests_without_moderator_approval = 0
WHERE max_guests_without_moderator_approval IS NULL;

ALTER TABLE public.event
  ALTER COLUMN max_guests_without_moderator_approval SET NOT NULL;

COMMIT;
