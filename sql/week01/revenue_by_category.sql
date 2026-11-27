-- Widget: "Revenue by category" card.
--
-- Write a query that returns total revenue (sum of order_items.price) per
-- product category, in English (product_category_name_translation has the
-- English names -- product_category_name on its own is Portuguese).
--
-- Expected columns: category, total_revenue
-- Expected order: total_revenue DESC
--
-- Hint: this needs a three-table join: order_items -> products ->
-- product_category_name_translation.

SELECT
    t.product_category_name_english AS category,
    SUM(oi.price) AS total_revenue
FROM order_items oi
JOIN products p
    ON oi.product_id = p.product_id
JOIN product_category_name_translation t
    ON p.product_category_name = t.product_category_name
GROUP BY t.product_category_name_english
ORDER BY total_revenue DESC;
