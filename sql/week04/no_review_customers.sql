-- Widget: "Ghost customers" table — the 20 customers with the most orders
-- who never left a review.
--
-- Expected columns: customer_id, customer_name, orders_without_review
-- Expected order: orders_without_review DESC
-- Expected row count: 20 -- use FETCH FIRST 20 ROWS ONLY (not LIMIT).
--
-- Hint: an anti-join (NOT EXISTS / LEFT JOIN ... WHERE IS NULL) is usually
-- clearer here than a correlated subquery in the SELECT list.


SELECT
    c.customer_id,
    c.customer_name,
    COUNT(o.order_id) AS orders_without_review
FROM customers c
JOIN orders o
    ON c.customer_id = o.customer_id
WHERE NOT EXISTS (
    SELECT 1
    FROM order_reviews r
    WHERE r.order_id = o.order_id
)
GROUP BY
    c.customer_id,
    c.customer_name
ORDER BY orders_without_review DESC, c.customer_id ASC
FETCH FIRST 20 ROWS ONLY;
