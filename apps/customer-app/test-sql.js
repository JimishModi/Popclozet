import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const query = `
    CREATE OR REPLACE FUNCTION claim_order(
      p_order_id UUID,
      p_rider_id UUID
    ) RETURNS JSONB AS $$
    DECLARE
      v_order_status TEXT;
      v_rider_role TEXT;
      v_order_rider_id UUID;
    BEGIN
      -- 1. Check if rider exists and has 'rider' role
      SELECT role INTO v_rider_role
      FROM profiles
      WHERE user_id = p_rider_id;

      IF v_rider_role IS NULL OR v_rider_role != 'rider' THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Invalid rider ID or role'
        );
      END IF;

      -- 2. Check order status and current rider
      SELECT status, rider_id INTO v_order_status, v_order_rider_id
      FROM orders
      WHERE id = p_order_id
      FOR UPDATE; -- Lock the row to prevent race conditions

      IF v_order_status IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Order not found'
        );
      END IF;

      IF v_order_status != 'pending' AND v_order_status != 'ready_for_pickup' THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Order is no longer available (' || v_order_status || ')'
        );
      END IF;

      IF v_order_rider_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Order already claimed by another rider'
        );
      END IF;

      -- 3. Update the order
      UPDATE orders
      SET 
        rider_id = p_rider_id,
        status = 'assigned',
        updated_at = NOW()
      WHERE id = p_order_id;

      RETURN jsonb_build_object(
        'success', true,
        'message', 'Order claimed successfully'
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // We have to execute raw SQL. Supabase-js REST API doesn't allow raw SQL execution natively.
  // Wait, I should use psql or we can just tell the user to run it in Supabase SQL editor.
  console.log("Please run this in your Supabase SQL Editor:", query);
}

run();
