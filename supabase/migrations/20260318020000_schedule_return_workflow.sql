-- =====================================================
-- Scheduled Return Workflow
-- =====================================================

-- PostgreSQL does not allow changing function parameter names with
-- CREATE OR REPLACE FUNCTION. Drop known legacy signatures first so
-- this migration can be rerun safely on partially migrated databases.
DROP FUNCTION IF EXISTS public.schedule_order_return(UUID, UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.approve_return_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.receive_return_at_warehouse(UUID, UUID);
DROP FUNCTION IF EXISTS public.receive_return_at_warehouse(UUID, UUID, TEXT);

DO $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        EXECUTE $view$
            CREATE VIEW public.profiles AS
            SELECT
                cp.user_id,
                cp.full_name,
                'customer'::TEXT AS role
            FROM public.customer_profiles cp
            UNION ALL
            SELECT
                rp.user_id,
                rp.full_name,
                'rider'::TEXT AS role
            FROM public.rider_profiles rp
            UNION ALL
            SELECT
                wp.user_id,
                wp.full_name,
                'warehouse'::TEXT AS role
            FROM public.warehouse_profiles wp
        $view$;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'scheduled_return',
    pickup_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    pickup_slot TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'requested',
    rider_id UUID,
    pickup_eta TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.return_requests'::regclass
          AND conname = 'return_requests_order_id_key'
    ) THEN
        ALTER TABLE public.return_requests
        ADD CONSTRAINT return_requests_order_id_key UNIQUE (order_id);
    END IF;
END $$;

-- 1) Extend return_requests and order_items for synchronized return flow
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS individual_id TEXT;

DO $$
BEGIN
    IF to_regclass('public.all_products') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.order_items'::regclass
             AND conname = 'order_items_individual_id_fkey'
       ) THEN
        ALTER TABLE public.order_items
        ADD CONSTRAINT order_items_individual_id_fkey
            FOREIGN KEY (individual_id)
            REFERENCES public.all_products(individual_id)
            ON UPDATE CASCADE
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_individual_id
ON public.order_items(individual_id);

DO $$
BEGIN
    IF to_regclass('public.return_requests') IS NOT NULL THEN
        ALTER TABLE public.return_requests
        ALTER COLUMN reason SET DEFAULT 'scheduled_return';

        ALTER TABLE public.return_requests
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

        ALTER TABLE public.return_requests
        ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

        ALTER TABLE public.return_requests
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

        ALTER TABLE public.return_requests
        ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.return_requests') IS NOT NULL THEN
        WITH ranked AS (
            SELECT
                ctid,
                row_number() OVER (
                    PARTITION BY order_id
                    ORDER BY created_at DESC, id DESC
                ) AS rn
            FROM public.return_requests
        )
        DELETE FROM public.return_requests rr
        USING ranked r
        WHERE rr.ctid = r.ctid
          AND r.rn > 1;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.return_requests'::regclass
              AND conname = 'return_requests_order_id_key'
        ) THEN
            ALTER TABLE public.return_requests
            ADD CONSTRAINT return_requests_order_id_key UNIQUE (order_id);
        END IF;
    END IF;
END $$;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS return_pickup_date DATE;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS return_time_slot TEXT;

-- 2) RLS additions for warehouse and return pickup visibility
DO $$
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'addresses'
          AND policyname = 'Warehouse & Admin view addresses'
    ) THEN
        CREATE POLICY "Warehouse & Admin view addresses"
            ON public.addresses
            FOR SELECT
            USING (
                auth.uid() IN (
                    SELECT user_id
                    FROM public.profiles
                    WHERE role IN ('warehouse', 'admin')
                )
            );
    END IF;

    IF to_regclass('public.profiles') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'order_items'
          AND policyname = 'Warehouse & Admin view order items'
    ) THEN
        CREATE POLICY "Warehouse & Admin view order items"
            ON public.order_items
            FOR SELECT
            USING (
                auth.uid() IN (
                    SELECT user_id
                    FROM public.profiles
                    WHERE role IN ('warehouse', 'admin')
                )
            );
    END IF;

    IF to_regclass('public.profiles') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'return_requests'
          AND policyname = 'Warehouse & Admin view return requests'
    ) THEN
        CREATE POLICY "Warehouse & Admin view return requests"
            ON public.return_requests
            FOR SELECT
            USING (
                auth.uid() IN (
                    SELECT user_id
                    FROM public.profiles
                    WHERE role IN ('warehouse', 'admin')
                )
            );
    END IF;

    IF to_regclass('public.profiles') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'return_requests'
          AND policyname = 'Warehouse & Admin update return requests'
    ) THEN
        CREATE POLICY "Warehouse & Admin update return requests"
            ON public.return_requests
            FOR UPDATE
            USING (
                auth.uid() IN (
                    SELECT user_id
                    FROM public.profiles
                    WHERE role IN ('warehouse', 'admin')
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.profiles') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Riders can view available and assigned orders" ON public.orders;
        CREATE POLICY "Riders can view available and assigned orders"
            ON public.orders
            FOR SELECT
            USING (
                rider_id = auth.uid()
                OR (
                    rider_id IS NULL
                    AND status IN ('ready_for_pickup', 'return_scheduled')
                    AND EXISTS (
                        SELECT 1
                        FROM public.profiles
                        WHERE user_id = auth.uid()
                          AND role = 'rider'
                    )
                )
            );

        DROP POLICY IF EXISTS "Riders can view addresses for their orders" ON public.addresses;
        CREATE POLICY "Riders can view addresses for their orders"
            ON public.addresses
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.orders
                    WHERE orders.delivery_address_id = addresses.id
                      AND (
                          orders.rider_id = auth.uid()
                          OR (
                              orders.rider_id IS NULL
                              AND orders.status IN ('ready_for_pickup', 'return_scheduled')
                          )
                      )
                )
                OR EXISTS (
                    SELECT 1
                    FROM public.return_requests
                    JOIN public.orders ON orders.id = return_requests.order_id
                    WHERE return_requests.pickup_address_id = addresses.id
                      AND (
                          orders.rider_id = auth.uid()
                          OR (
                              orders.rider_id IS NULL
                              AND orders.status IN ('return_scheduled')
                          )
                      )
                )
            );

        DROP POLICY IF EXISTS "Riders can view items for their orders" ON public.order_items;
        CREATE POLICY "Riders can view items for their orders"
            ON public.order_items
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.orders
                    WHERE orders.id = order_items.order_id
                      AND (
                          orders.rider_id = auth.uid()
                          OR (
                              orders.rider_id IS NULL
                              AND orders.status IN ('ready_for_pickup', 'return_scheduled')
                          )
                      )
                )
            );
    END IF;
END $$;

-- 3) Physical-unit assignment during warehouse packing
CREATE OR REPLACE FUNCTION public.assign_order_units(
    p_order_id UUID,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_unit RECORD;
    v_assigned_count INTEGER := 0;
BEGIN
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can assign physical units'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    FOR v_item IN
        SELECT oi.id, oi.product_id, oi.size
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.individual_id IS NULL
        ORDER BY oi.id
    LOOP
        SELECT ap.individual_id, ap.inventory_id
        INTO v_unit
        FROM public.all_products ap
        JOIN public.inventory i ON i.id = ap.inventory_id
        WHERE i.product_id = v_item.product_id
          AND (v_item.size IS NULL OR i.size = v_item.size)
          AND COALESCE(ap.available, TRUE) = TRUE
          AND COALESCE(ap.status, 'available') = 'available'
        ORDER BY ap.last_washed NULLS FIRST, ap.created_at, ap.individual_id
        FOR UPDATE OF ap SKIP LOCKED
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No available physical unit for product % size %',
                v_item.product_id,
                COALESCE(v_item.size, 'N/A')
                USING ERRCODE = '23514';
        END IF;

        UPDATE public.order_items
        SET individual_id = v_unit.individual_id
        WHERE id = v_item.id;

        UPDATE public.all_products
        SET status = 'rented',
            available = FALSE,
            last_rented = NOW(),
            times_rented = COALESCE(times_rented, 0) + 1
        WHERE individual_id = v_unit.individual_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    IF v_assigned_count > 0 AND to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'assign_order_units',
            'order',
            p_order_id,
            p_actor_id,
            jsonb_build_object('assigned_count', v_assigned_count)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'assignedCount', v_assigned_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_order_units(UUID, UUID) TO authenticated;

-- Avoid double-decrementing inventory for orders that already have linked units
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_dispatch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'out_for_delivery' AND (OLD.status IS DISTINCT FROM 'out_for_delivery') THEN
        UPDATE public.inventory i
        SET available_stock = GREATEST(0, i.available_stock - oi.item_count)
        FROM (
            SELECT product_id, size, COUNT(*) AS item_count
            FROM public.order_items
            WHERE order_id = NEW.id
              AND individual_id IS NULL
            GROUP BY product_id, size
        ) oi
        WHERE i.product_id = oi.product_id
          AND i.size = oi.size;

        IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
            INSERT INTO public.warehouse_activity_log (
                action,
                entity_type,
                entity_id,
                actor_id,
                details
            )
            VALUES (
                'auto_inventory_deduction',
                'order',
                NEW.id,
                NEW.rider_id,  -- NULL when no rider assigned — no fake UUID
                jsonb_build_object('status', 'out_for_delivery')
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Return scheduling and warehouse workflow RPCs
CREATE OR REPLACE FUNCTION public.schedule_order_return(
    p_order_id UUID,
    p_pickup_address_id UUID,
    p_pickup_slot TIMESTAMPTZ,
    p_reason TEXT DEFAULT 'scheduled_return'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order RECORD;
    v_return_request_id UUID;
    v_reason TEXT := NULLIF(TRIM(COALESCE(p_reason, 'scheduled_return')), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    IF p_pickup_slot IS NULL THEN
        RAISE EXCEPTION 'A pickup slot is required'
            USING ERRCODE = '23502';
    END IF;

    SELECT id, user_id, status
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_order.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You can only schedule returns for your own orders'
            USING ERRCODE = '42501';
    END IF;

    IF v_order.status NOT IN ('delivered', 'in_use') THEN
        RAISE EXCEPTION 'Returns can only be scheduled once an order is delivered and active'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.addresses
        WHERE id = p_pickup_address_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Pickup address does not belong to the current user'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.return_requests (
        order_id,
        reason,
        pickup_address_id,
        pickup_slot,
        status,
        rider_id,
        pickup_eta,
        approved_at,
        picked_up_at,
        completed_at,
        received_at
    ) VALUES (
        p_order_id,
        COALESCE(v_reason, 'scheduled_return'),
        p_pickup_address_id,
        p_pickup_slot,
        'requested',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (order_id) DO UPDATE SET
        reason = EXCLUDED.reason,
        pickup_address_id = EXCLUDED.pickup_address_id,
        pickup_slot = EXCLUDED.pickup_slot,
        status = 'requested',
        rider_id = NULL,
        pickup_eta = NULL,
        approved_at = NULL,
        picked_up_at = NULL,
        completed_at = NULL,
        received_at = NULL
    RETURNING id INTO v_return_request_id;

    UPDATE public.orders
    SET status = 'return_requested',
        return_pickup_date = (p_pickup_slot AT TIME ZONE 'Asia/Kolkata')::DATE,
        return_time_slot = to_char(
            p_pickup_slot AT TIME ZONE 'Asia/Kolkata',
            'HH12:MI AM'
        ),
        otp_return = NULL,
        rider_id = NULL,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'schedule_return',
            'order',
            p_order_id,
            v_user_id,
            jsonb_build_object(
                'pickup_address_id', p_pickup_address_id,
                'pickup_slot', p_pickup_slot
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'requestId', v_return_request_id,
        'orderId', p_order_id,
        'status', 'return_requested'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_order_return(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_return_request(
    p_return_request_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request RECORD;
    v_order RECORD;
BEGIN
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can approve return requests'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_request
    FROM public.return_requests
    WHERE id = p_return_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found: %', p_return_request_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = v_request.order_id
    FOR UPDATE;

    IF v_request.status = 'approved' AND v_order.status = 'return_scheduled' THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'orderId', v_request.order_id,
            'status', 'return_scheduled'
        );
    END IF;

    IF v_request.status <> 'requested' THEN
        RAISE EXCEPTION 'Only requested returns can be approved'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.return_requests
    SET status = 'approved',
        approved_at = NOW(),
        rider_id = NULL
    WHERE id = p_return_request_id;

    UPDATE public.orders
    SET status = 'return_scheduled',
        rider_id = NULL,
        updated_at = NOW()
    WHERE id = v_request.order_id;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'approve_return_request',
            'order',
            v_request.order_id,
            p_actor_id,
            jsonb_build_object('return_request_id', p_return_request_id)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', v_request.order_id,
        'status', 'return_scheduled'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_return_request(UUID, UUID) TO authenticated;

-- 5) Return completion after all linked units are washed and available again
CREATE OR REPLACE FUNCTION public.refresh_return_completion_for_order(
    p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_items BOOLEAN := FALSE;
    v_missing_links BOOLEAN := FALSE;
    v_pending_units INTEGER := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.orders
        WHERE id = p_order_id
          AND status = 'returned'
    ) THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.order_items
        WHERE order_id = p_order_id
    )
    INTO v_has_items;

    IF NOT v_has_items THEN
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.order_items
        WHERE order_id = p_order_id
          AND individual_id IS NULL
    )
    INTO v_missing_links;

    IF v_missing_links THEN
        RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_pending_units
    FROM public.order_items oi
    JOIN public.all_products ap ON ap.individual_id = oi.individual_id
    WHERE oi.order_id = p_order_id
      AND COALESCE(ap.status, 'available') <> 'available';

    IF v_pending_units = 0 THEN
        UPDATE public.orders
        SET status = 'return_completed',
            updated_at = NOW()
        WHERE id = p_order_id
          AND status = 'returned';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_all_products_return_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        FOR v_order_id IN
            SELECT DISTINCT order_id
            FROM public.order_items
            WHERE individual_id = NEW.individual_id
        LOOP
            PERFORM public.refresh_return_completion_for_order(v_order_id);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_all_products_return_completion ON public.all_products;
CREATE TRIGGER trg_handle_all_products_return_completion
AFTER UPDATE OF status ON public.all_products
FOR EACH ROW
EXECUTE FUNCTION public.handle_all_products_return_completion();

CREATE OR REPLACE FUNCTION public.receive_return_at_warehouse(
    p_order_id UUID,
    p_actor_id UUID,
    p_otp TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_request RECORD;
    v_rider_earning NUMERIC := 0;
BEGIN
    -- Only warehouse/admin can receive returns
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can receive returns'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Must be in return_at_warehouse status (rider must have dropped off first)
    IF v_order.status <> 'return_at_warehouse' THEN
        RAISE EXCEPTION 'Rider must drop off the return first (current status: %)', v_order.status
            USING ERRCODE = '23514';
    END IF;

    -- OTP verification
    IF p_otp IS NULL OR TRIM(p_otp) = '' THEN
        RAISE EXCEPTION 'OTP is required to receive returns'
            USING ERRCODE = '23514';
    END IF;

    IF v_order.warehouse_otp_used = TRUE THEN
        RAISE EXCEPTION 'OTP has already been used'
            USING ERRCODE = '23514';
    END IF;

    IF v_order.warehouse_otp_expires_at < NOW() THEN
        RAISE EXCEPTION 'OTP has expired. Ask the rider to regenerate.'
            USING ERRCODE = '23514';
    END IF;

    -- Increment attempts
    UPDATE public.orders
    SET warehouse_otp_attempts = COALESCE(warehouse_otp_attempts, 0) + 1
    WHERE id = p_order_id;

    IF COALESCE(v_order.warehouse_otp_attempts, 0) >= 5 THEN
        RAISE EXCEPTION 'Too many OTP attempts. Ask the rider to regenerate.'
            USING ERRCODE = '23514';
    END IF;

    IF v_order.warehouse_otp IS NULL OR v_order.warehouse_otp <> p_otp THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Invalid OTP code'
        );
    END IF;

    -- OTP is valid — proceed with receiving the return
    SELECT *
    INTO v_request
    FROM public.return_requests
    WHERE order_id = p_order_id
    FOR UPDATE;

    UPDATE public.orders
    SET status = 'returned',
        warehouse_otp_used = TRUE,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF v_request.id IS NOT NULL THEN
        UPDATE public.return_requests
        SET status = 'completed',
            completed_at = NOW(),
            received_at = NOW()
        WHERE id = v_request.id;
    END IF;

    -- Credit rider earnings
    IF to_regclass('public.wallets') IS NOT NULL
       AND to_regclass('public.rider_transactions') IS NOT NULL
       AND v_order.rider_id IS NOT NULL THEN
        v_rider_earning := GREATEST(COALESCE(v_order.delivery_fee, 0), 40);

        INSERT INTO public.wallets (user_id, rider_id)
        VALUES (v_order.rider_id, v_order.rider_id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.rider_transactions (
            rider_id, order_id, type, amount, description
        ) VALUES (
            v_order.rider_id,
            p_order_id,
            'earning',
            v_rider_earning,
            'Scheduled return completed at warehouse'
        );

        UPDATE public.wallets
        SET balance = COALESCE(balance, 0) + v_rider_earning
        WHERE user_id = v_order.rider_id;
    END IF;

    IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action, entity_type, entity_id, actor_id, details
        ) VALUES (
            'receive_return_at_warehouse',
            'order',
            p_order_id,
            p_actor_id,
            jsonb_build_object('rider_id', v_order.rider_id)
        );
    END IF;

    PERFORM public.refresh_return_completion_for_order(p_order_id);

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'status', (
            SELECT status
            FROM public.orders
            WHERE id = p_order_id
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_return_at_warehouse(UUID, UUID, TEXT) TO authenticated;

-- 6) Reuse OTP infrastructure for return pickup, not warehouse receipt
DROP FUNCTION IF EXISTS public.verify_order_otp(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.verify_order_otp(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.resend_order_otp(
    p_order_id UUID,
    p_otp_type TEXT
)
RETURNS VOID AS $$
DECLARE
    v_new_otp TEXT;
BEGIN
    v_new_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    IF p_otp_type = 'delivery' THEN
        UPDATE public.orders
        SET otp_delivery = v_new_otp,
            updated_at = NOW()
        WHERE id = p_order_id;
    ELSIF p_otp_type = 'return' THEN
        UPDATE public.orders
        SET otp_return = v_new_otp,
            updated_at = NOW()
        WHERE id = p_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.verify_order_otp(
    p_order_id UUID,
    p_otp_code TEXT,
    p_otp_type TEXT,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order_otp TEXT;
    v_duration INTEGER;
BEGIN
    SELECT CASE
        WHEN p_otp_type = 'delivery' THEN otp_delivery
        ELSE otp_return
    END
    INTO v_order_otp
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order_otp IS NULL OR v_order_otp <> p_otp_code THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid code');
    END IF;

    IF p_otp_type = 'delivery' THEN
        SELECT COALESCE(MAX(rental_duration_days), 3)
        INTO v_duration
        FROM public.order_items
        WHERE order_id = p_order_id;

        UPDATE public.orders
        SET status = 'delivered',
            rental_start_date = NOW(),
            rental_end_date = NOW() + (v_duration || ' days')::INTERVAL,
            updated_at = NOW()
        WHERE id = p_order_id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'message', 'Delivery verified. Rental started!'
        );
    END IF;

    UPDATE public.orders
    SET status = 'return_picked_up',
        updated_at = NOW()
    WHERE id = p_order_id;

    IF to_regclass('public.return_requests') IS NOT NULL THEN
        UPDATE public.return_requests
        SET status = 'picked_up',
            picked_up_at = NOW(),
            rider_id = COALESCE(p_actor_id, rider_id)
        WHERE order_id = p_order_id
          AND status IN ('approved', 'dispatched', 'picked_up');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Return pickup verified'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.verify_order_otp(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 7) Generalize rider notification broadcast + claim/release for return pickups
CREATE OR REPLACE FUNCTION public.notify_order_to_available_riders(
    p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.rider_notifications (order_id, rider_id)
    SELECT p_order_id, p.user_id
    FROM public.profiles p
    JOIN public.orders o ON o.id = p_order_id
    WHERE p.role = 'rider'
      AND o.rider_id IS NULL
      AND o.status IN ('ready_for_pickup', 'return_scheduled')
      AND NOT EXISTS (
          SELECT 1
          FROM public.order_cancellations oc
          WHERE oc.order_id = p_order_id
            AND oc.rider_id = p.user_id
      )
    ON CONFLICT (order_id, rider_id)
    DO UPDATE SET
        status = 'pending',
        created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_order_to_riders()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rider_id IS NULL
       AND NEW.status IN ('ready_for_pickup', 'return_scheduled')
       AND (
           OLD.status IS DISTINCT FROM NEW.status
           OR OLD.rider_id IS DISTINCT FROM NEW.rider_id
       ) THEN
        PERFORM public.notify_order_to_available_riders(NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_order(
    p_order_id UUID,
    p_rider_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_order RECORD;
    v_reset_status TEXT;
BEGIN
    SELECT id, rider_id, status
    INTO v_current_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order does not exist');
    END IF;

    IF v_current_order.rider_id <> p_rider_id THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'You cannot release an order you do not own');
    END IF;

    IF to_regclass('public.order_cancellations') IS NOT NULL THEN
        INSERT INTO public.order_cancellations (order_id, rider_id, reason)
        VALUES (p_order_id, p_rider_id, p_reason);
    END IF;

    v_reset_status := CASE
        WHEN v_current_order.status = 'return_dispatched' THEN 'return_scheduled'
        ELSE 'ready_for_pickup'
    END;

    UPDATE public.orders
    SET rider_id = NULL,
        status = v_reset_status,
        claim_attempts = COALESCE(claim_attempts, 0) + 1,
        updated_at = NOW()
    WHERE id = p_order_id;

    IF v_current_order.status = 'return_dispatched'
       AND to_regclass('public.return_requests') IS NOT NULL THEN
        UPDATE public.return_requests
        SET status = 'approved',
            rider_id = NULL,
            pickup_eta = NULL
        WHERE order_id = p_order_id
          AND status IN ('approved', 'dispatched');
    END IF;

    IF to_regclass('public.delivery_tracking') IS NOT NULL THEN
        DELETE FROM public.delivery_tracking
        WHERE order_id = p_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', v_reset_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.claim_order(
    p_order_id UUID,
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_order_rider_id UUID;
    v_rider_name TEXT;
BEGIN
    SELECT full_name
    INTO v_rider_name
    FROM public.profiles
    WHERE user_id = p_rider_id;

    SELECT status, rider_id
    INTO v_current_status, v_order_rider_id
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order does not exist');
    END IF;

    IF v_current_status NOT IN ('ready_for_pickup', 'return_scheduled') THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order is not available to claim');
    END IF;

    IF v_order_rider_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Order already claimed by another rider');
    END IF;

    IF v_current_status = 'return_scheduled' THEN
        UPDATE public.orders
        SET rider_id = p_rider_id,
            status = 'return_dispatched',
            updated_at = NOW()
        WHERE id = p_order_id;

        IF to_regclass('public.return_requests') IS NOT NULL THEN
            UPDATE public.return_requests
            SET status = 'dispatched',
                rider_id = p_rider_id
            WHERE order_id = p_order_id
              AND status IN ('approved', 'dispatched');
        END IF;

        PERFORM public.resend_order_otp(p_order_id, 'return');
    ELSE
        UPDATE public.orders
        SET rider_id = p_rider_id,
            status = 'driver_arrived_warehouse',
            updated_at = NOW()
        WHERE id = p_order_id;

        IF to_regclass('public.delivery_tracking') IS NOT NULL THEN
            INSERT INTO public.delivery_tracking (order_id, driver_name, is_active, updated_at)
            VALUES (p_order_id, COALESCE(v_rider_name, 'Rider'), TRUE, NOW())
            ON CONFLICT (order_id) DO UPDATE
            SET driver_name = COALESCE(v_rider_name, EXCLUDED.driver_name),
                is_active = TRUE,
                updated_at = NOW();
        END IF;
    END IF;

    DELETE FROM public.rider_notifications
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', CASE
            WHEN v_current_status = 'return_scheduled' THEN 'return_dispatched'
            ELSE 'driver_arrived_warehouse'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
