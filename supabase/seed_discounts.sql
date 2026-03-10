-- Seed Data for Product Discounts
-- Linked to the 35 products generated for jackets, footwear, and accessories

INSERT INTO public.product_discounts (product_id, discount_type, discount_value, is_active) VALUES
-- Jackets (15 products) - 10-20% discounts
('1d6a4578-9a84-4de8-a518-0d1f7f54a4ba', 'percentage', 10.00, true),
('9594706c-9840-454d-8537-20b93a86ffe3', 'percentage', 15.00, true),
('d467d57c-ae72-46dc-a003-5ba27bc55ce1', 'percentage', 20.00, true),
('714e6f25-84e0-4d94-8961-5f76e2fb0bf5', 'percentage', 10.00, true),
('4b32d74b-9f1a-4364-9ddb-41cbabf8fb9c', 'percentage', 15.00, true),
('c03fa87e-a3a7-4946-900a-ea437b3b9d77', 'percentage', 20.00, true),
('ec289a4d-34eb-4c51-a36e-0bcb90a3e28d', 'percentage', 10.00, true),
('e8d9aab2-a324-4b5d-ac5b-054d302ca5ed', 'percentage', 15.00, true),
('65a6277d-13fc-49ec-bcd1-27428c37d15e', 'percentage', 20.00, true),
('aaf95032-9a20-4fa2-9f0a-880af43c5d8b', 'percentage', 10.00, true),
('1cdb2ac2-ea9d-4630-8972-110aef4d87de', 'percentage', 15.00, true),
('c85e2d4f-0966-4448-9c54-9211028d38a8', 'percentage', 20.00, true),
('edafcf8a-26df-453c-b575-a4193636000b', 'percentage', 10.00, true),
('3836bf39-a760-420a-84ff-86fbc6ab3d5e', 'percentage', 15.00, true),
('a561cff9-1c30-4bcd-84cd-896ba04fe0f7', 'percentage', 20.00, true),

-- Footwear (10 products) - 5-15% discounts
('0f35bc77-337a-4de3-b2f6-a921414e98f9', 'percentage', 5.00, true),
('2bac3f6d-b122-46c5-a41e-1d421c4f6d34', 'percentage', 10.00, true),
('1bf07b32-b8fd-43e2-95c9-dff346b90756', 'percentage', 15.00, true),
('3a20208e-1af5-45c3-a4de-f66ea1a56b88', 'percentage', 5.00, true),
('c327aaa2-e405-40c2-8023-8ba752c3a4da', 'percentage', 10.00, true),
('1da2742d-ff66-4ace-876c-76e317d4948c', 'percentage', 15.00, true),
('063f5ca3-76c5-4f26-b55d-8225b0cc46f0', 'percentage', 5.00, true),
('178a1a82-ee0e-4724-b362-05ae6a073ad1', 'percentage', 10.00, true),
('a676f55e-2c57-4f0c-99b2-69253e833c28', 'percentage', 15.00, true),
('896951b1-ff5a-4160-bae9-9a25dd8605be', 'percentage', 5.00, true),

-- Accessories (10 products) - Fixed 25% launch discount
('367d0adc-7cb7-4129-a4f8-2f9dcde4143b', 'percentage', 25.00, true),
('6e0ac450-ff2f-4720-9b34-5d24fc606168', 'percentage', 25.00, true),
('c5f91f50-b3b5-45e5-afd7-d212845a2079', 'percentage', 25.00, true),
('561a9588-234f-4b5f-8630-54df0fc3ed08', 'percentage', 25.00, true),
('2b9ee0a1-29fd-42ce-8900-3baec30ee880', 'percentage', 25.00, true),
('408b7ab2-b3da-4625-bb82-10211f8a7d56', 'percentage', 25.00, true),
('01b87a97-2a0e-4c6a-b84b-630adcea0f6c', 'percentage', 25.00, true),
('c55e68c6-6dad-42ee-929a-e4995107bc1d', 'percentage', 25.00, true),
('3938b029-362d-40db-bad8-b605c4ea5812', 'percentage', 25.00, true),
('556426e1-3b4b-4a7e-bb17-c63f300c2f3c', 'percentage', 25.00, true)
ON CONFLICT (id) DO NOTHING;
