-- Widget: "Seller summary" — backed by a VIEW instead of a raw query, so the
-- dashboard stays fast even as the dataset grows.
--
-- 1. CREATE OR REPLACE VIEW seller_summary AS ... (seller_id, seller_name,
--    items_sold, total_revenue, avg_review_score per seller)
-- 2. Then SELECT * FROM seller_summary ORDER BY total_revenue DESC;
--
-- This is also the week to look at geolocation with EXPLAIN ANALYZE and add
-- whatever index actually helps -- see the README's "performance week" note.

CREATE OR REPLACE VIEW seller_summary AS
SELECT
    s.seller_id,
    s.seller_name,
    COUNT(oi.order_item_id) AS items_sold,
    SUM(oi.price) AS total_revenue,
    ROUND(AVG(r.review_score), 2) AS avg_review_score
FROM sellers s
JOIN order_items oi
    ON s.seller_id = oi.seller_id
LEFT JOIN order_reviews r
    ON oi.order_id = r.order_id
GROUP BY
    s.seller_id,
    s.seller_name;

SELECT * FROM seller_summary
ORDER BY total_revenue DESC;
