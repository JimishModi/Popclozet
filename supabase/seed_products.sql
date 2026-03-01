
-- Clean up existing products (optional, use with caution)
-- DELETE FROM products;

-- 15 Leather Jackets (10 Men, 5 Women)
INSERT INTO products (name, brand, category, gender, occasion, rental_price, deposit_amount, images, fabric_details, sizes_available, hygiene_info, is_available)
SELECT 
    'Men Genuine Leather Jacket ' || i, 
    'LeatherCo', 
    'jackets', 
    'men', 
    ARRAY['casual', 'party'], 
    799.00, 
    2000.00, 
    ARRAY['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop'], 
    '{"material": "Genuine Leather", "lining": "Silk"}'::JSONB, 
    '["M", "L", "XL"]'::JSONB, 
    '{"last_cleaned": "2024-03-05", "dry_cleaned": true}'::JSONB, 
    true
FROM generate_series(1, 10) s(i);

INSERT INTO products (name, brand, category, gender, occasion, rental_price, deposit_amount, images, fabric_details, sizes_available, hygiene_info, is_available)
SELECT 
    'Women Premium Leather Jacket ' || i, 
    'LeatherCo', 
    'jackets', 
    'women', 
    ARRAY['casual', 'party'], 
    699.00, 
    1800.00, 
    ARRAY['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000&auto=format&fit=crop'], 
    '{"material": "Genuine Leather", "lining": "Silk"}'::JSONB, 
    '["S", "M", "L"]'::JSONB, 
    '{"last_cleaned": "2024-03-05", "dry_cleaned": true}'::JSONB, 
    true
FROM generate_series(1, 5) s(i);

-- 10 Shoes (5 Men, 5 Women)
INSERT INTO products (
  name, brand, category, gender, occasion, rental_price, deposit_amount, images, 
  fabric_details, sizes_available, hygiene_info, is_available
)
SELECT 
  'Men Premium Leather Shoe ' || i, 
  'Nike', 
  'footwear', 
  'men', 
  ARRAY['casual', 'semi-formal'], 
  499, 
  1200, 
  ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff'], 
  '{"material": "Leather", "sole": "Rubber"}'::JSONB, 
  '["8", "9", "10", "11"]'::JSONB, 
  '{"last_cleaned": "2024-03-05", "sanitized": true}'::JSONB, 
  true 
FROM generate_series(1, 5) s(i);

INSERT INTO products (
  name, brand, category, gender, occasion, rental_price, deposit_amount, images, 
  fabric_details, sizes_available, hygiene_info, is_available
)
SELECT 
  'Women Elegant Heel ' || i, 
  'Aldo', 
  'footwear', 
  'women', 
  ARRAY['party', 'formal'], 
  599, 
  1500, 
  ARRAY['https://images.unsplash.com/photo-1543163521-1bf539c55dd2'], 
  '{"material": "Suede", "heel_height": "3 inch"}'::JSONB, 
  '["6", "7", "8"]'::JSONB, 
  '{"last_cleaned": "2024-03-05", "sanitized": true}'::JSONB, 
  true 
FROM generate_series(1, 5) s(i);

-- 10 Accessories (4 Men, 6 Women)
INSERT INTO products (
  name, brand, category, gender, occasion, rental_price, deposit_amount, images, 
  fabric_details, sizes_available, hygiene_info, is_available
)
SELECT 
  'Men Luxury Watch ' || i, 
  'Fossil', 
  'accessories', 
  'men', 
  ARRAY['formal', 'party'], 
  399, 
  1000, 
  ARRAY['https://images.unsplash.com/photo-1523275335684-37898b6baf30'], 
  '{"material": "Stainless Steel", "movement": "Quartz"}'::JSONB, 
  '["onesize"]'::JSONB, 
  '{"last_cleaned": "2024-03-05", "sanitized": true}'::JSONB, 
  true 
FROM generate_series(1, 4) s(i);

INSERT INTO products (
  name, brand, category, gender, occasion, rental_price, deposit_amount, images, 
  fabric_details, sizes_available, hygiene_info, is_available
)
SELECT 
  'Women Designer Handbag ' || i, 
  'Coach', 
  'accessories', 
  'women', 
  ARRAY['party', 'casual'], 
  499, 
  1500, 
  ARRAY['https://images.unsplash.com/photo-1584917033904-493bb3c3ccad'], 
  '{"material": "Leather"}'::JSONB, 
  '["onesize"]'::JSONB, 
  '{"last_cleaned": "2024-03-05", "sanitized": true}'::JSONB, 
  true 
FROM generate_series(1, 6) s(i);
