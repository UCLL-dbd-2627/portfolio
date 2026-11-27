-- Widget: "Category summary" -- backed by a VIEW, same pattern as
-- seller_summary_view.sql. Different table, same idea: get comfortable
-- writing views, not just one.
--
-- 1. CREATE OR REPLACE VIEW category_summary AS ... (category, items_sold,
--    total_revenue, joining order_items -> products -> category translation)
-- 2. Then SELECT * FROM category_summary ORDER BY total_revenue DESC;

CREATE OR REPLACE VIEW category_summary AS
SELECT
    t.product_category_name_english AS category,
    COUNT(oi.order_item_id) AS items_sold,
    SUM(oi.price) AS total_revenue
FROM order_items oi
JOIN products p
    ON oi.product_id = p.product_id
JOIN product_category_name_translation t
    ON p.product_category_name = t.product_category_name
GROUP BY
    t.product_category_name_english;

SELECT * FROM category_summary
ORDER BY total_revenue DESC;
