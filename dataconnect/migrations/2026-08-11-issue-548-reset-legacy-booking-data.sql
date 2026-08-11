BEGIN;

-- Issue #548 deliberately resets the booking domain in non-live environments.
-- Run this once, before deploying the schema that removes GuestTicketRequest and
-- makes booking_line.booking_place_id NOT NULL. Do not run it in a live system.
-- The site has not launched, so retaining synthetic booking/payment data is less
-- valuable than guaranteeing that no row can carry the retired split-request model.

DELETE FROM public.notification_delivery;
DELETE FROM public.payment_reconciliation_exception;
DELETE FROM public.payment_webhook_event;
DELETE FROM public.booking_place_payment_allocation;
DELETE FROM public.booking_payment_adjustment;
DELETE FROM public.booking_line;
DELETE FROM public.ticket_order;
DELETE FROM public.booking_place;
DELETE FROM public.booking;

DROP TABLE IF EXISTS public.guest_ticket_request;
DROP TYPE IF EXISTS public.guest_ticket_request_status;

ALTER TABLE public.booking
  DROP COLUMN IF EXISTS booker_dietary_note;

COMMIT;
