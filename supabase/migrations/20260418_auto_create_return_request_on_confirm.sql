-- Auto-create return_request when order is confirmed and has a pre-scheduled return slot.
-- This makes checkout-scheduled returns visible in the warehouse Returns page immediately
-- after order confirmation, instead of waiting for the auto-dispatch cron.

CREATE OR REPLACE FUNCTION public.auto_create_return_request_on_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_pickup_ts TIMESTAMPTZ;
BEGIN
    -- Only fire when order transitions to 'confirmed'
    IF NEW.status != 'confirmed' THEN
        RETURN NEW;
    END IF;

    -- Only if return slot was set at checkout
    IF NEW.return_pickup_date IS NULL OR NEW.return_time_slot IS NULL THEN
        RETURN NEW;
    END IF;

    -- Don't create if return_request already exists for this order
    IF EXISTS (SELECT 1 FROM public.return_requests WHERE order_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Build pickup timestamp from date + time slot
    BEGIN
        v_pickup_ts := (
            NEW.return_pickup_date::TEXT || ' ' || NEW.return_time_slot
        )::TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

    INSERT INTO public.return_requests (
        order_id,
        reason,
        pickup_address_id,
        pickup_slot,
        status,
        approved_at
    ) VALUES (
        NEW.id,
        'pre_scheduled',
        NEW.delivery_address_id,
        v_pickup_ts,
        'approved',
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on INSERT (COD orders are inserted as 'confirmed')
-- and on UPDATE (online payment orders go pending_payment → confirmed)
DROP TRIGGER IF EXISTS trg_auto_create_return_request ON orders;

CREATE TRIGGER trg_auto_create_return_request
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION public.auto_create_return_request_on_confirm();
