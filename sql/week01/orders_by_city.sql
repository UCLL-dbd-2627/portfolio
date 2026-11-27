-- Widget: "Orders by city" bar chart.
--
-- Write a query that returns the number of orders placed by customers in
-- each city, for cities with more than 1 order, most orders first.
--
-- Expected columns: customer_city, order_count
-- Expected order: order_count DESC, then customer_city ASC to break ties
-- (ties WILL happen in this data -- always give ORDER BY a tiebreaker when
-- the primary sort key can repeat, or your result order isn't guaranteed).

SELECT
    c.customer_city,
    COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o
    ON c.customer_id = o.customer_id
GROUP BY c.customer_city
HAVING COUNT(o.order_id) > 1
ORDER BY
    order_count DESC,
    customer_city ASC;
