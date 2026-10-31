-- Widget: "Monthly revenue trend" chart.
--
-- For each calendar month, compute total revenue (sum of order_items.price
-- for orders purchased that month), and the change from the previous month.
--
-- Expected columns: month, monthly_revenue, change_from_prev_month
-- Expected order: month ASC
--
-- Hint: date_trunc('month', order_purchase_timestamp) buckets a timestamp
-- into its month. LAG() OVER (ORDER BY month) gets the previous row's value
-- to subtract from the current one -- the first month should show NULL,
-- there's nothing before it to compare against.

WITH monthly AS (
    SELECT
        date_trunc('month', o.order_purchase_timestamp) AS month,
        SUM(oi.price) AS monthly_revenue
    FROM orders o
    JOIN order_items oi
        ON o.order_id = oi.order_id
    GROUP BY
        date_trunc('month', o.order_purchase_timestamp)
)
SELECT
    month,
    monthly_revenue,
    monthly_revenue - LAG(monthly_revenue) OVER (ORDER BY month) AS change_from_prev_month
FROM monthly
ORDER BY
    month ASC;
