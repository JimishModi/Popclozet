-- Migration: Create Product Reviews Table and Triggers

-- 1) Create product_reviews Table
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_review UNIQUE(user_id, product_id, order_id)
);

-- 2) Update order_items to track reviews
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT false;

-- 3) Update products for aggregated ratings
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- 4) Trigger function to update product stats after review
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- SET the order_item as reviewed. 
  -- We update ALL order items for this product in this order.
  UPDATE public.order_items
  SET is_reviewed = true
  WHERE order_id = NEW.order_id
    AND product_id = NEW.product_id;

  -- Update product avg_rating and total_reviews
  UPDATE public.products
  SET total_reviews = (
        SELECT COUNT(*) FROM public.product_reviews WHERE product_id = NEW.product_id
      ),
      avg_rating = (
        SELECT COALESCE(AVG(rating), 0.0) FROM public.product_reviews WHERE product_id = NEW.product_id
      )
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_product_rating ON public.product_reviews;
CREATE TRIGGER trigger_update_product_rating
AFTER INSERT OR UPDATE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating();

-- 5) RLS Policies
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product reviews"
  ON public.product_reviews FOR SELECT
  USING (true);

-- Ensure user can only insert a review for their own returned order
CREATE POLICY "Users can insert their own reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.orders 
      WHERE id = order_id AND user_id = auth.uid() AND status IN ('returned', 'return_completed')
    )
  );

-- Expose to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE product_reviews;
