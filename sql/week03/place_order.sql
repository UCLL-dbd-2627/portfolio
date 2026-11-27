-- Widget: "Place a demo order" button.
--
-- The dashboard runs this script when the button is clicked (see
-- sql/week03/place_order.js for the tiny bit of JS wiring). It should:
--
--   1. Insert a new row into `orders` for ANY existing customer --
--      e.g. (SELECT customer_id FROM customers ORDER BY customer_id LIMIT 1)
--      -- order_status 'processing', order_purchase_timestamp now(),
--      order_estimated_delivery_date now() + interval '14 days',
--      using order_id 'order_demo_001'.
--   2. SAVEPOINT before adding items.
--   3. Insert TWO order_items rows for that order, each for ANY existing
--      product and seller (same subquery idea as above -- you don't need
--      to know a specific product_id/seller_id, just pick one that exists).
--   4. COMMIT the whole thing.
--
-- Don't hardcode a specific customer_id/product_id/seller_id -- this course
-- swaps between a small sample dataset and the real one, and a literal ID
-- that exists in one won't exist in the other. Picking "any row that
-- exists" via a subquery works regardless of which dataset is loaded.
--
-- Run this whole file as one transaction: if you re-run it, wrap the INSERT
-- into `orders` so it doesn't fail on a duplicate order_id (e.g. delete the
-- demo order first, or use ON CONFLICT DO NOTHING) -- the grader resets the
-- database between runs, but you'll want that for local testing too.


BEGIN;

INSERT INTO orders (
    order_id,
    customer_id,
    order_status,
    order_purchase_timestamp,
    order_estimated_delivery_date
)
SELECT
    'order_demo_001',
    customer_id,
    'processing',
    NOW(),
    NOW() + INTERVAL '14 days'
FROM customers
ORDER BY customer_id
LIMIT 1
ON CONFLICT (order_id) DO NOTHING;

SAVEPOINT before_items;

INSERT INTO order_items (
    order_id,
    order_item_id,
    product_id,
    seller_id,
    shipping_limit_date,
    price,
    freight_value
)
SELECT
    'order_demo_001',
    item_number,
    (SELECT product_id FROM products ORDER BY product_id LIMIT 1 OFFSET item_number - 1),
    (SELECT seller_id FROM sellers ORDER BY seller_id LIMIT 1),
    NOW() + INTERVAL '7 days',
    100.00,
    10.00
FROM generate_series(1, 2) AS item_number
ON CONFLICT (order_id, order_item_id) DO NOTHING;

COMMIT;

SELECT
    order_id,
    customer_id,
    order_status
FROM orders
WHERE order_id = 'order_demo_001';
