-- Widget: "Payment methods" chart.
--
-- Write a query that returns the number of payments per payment_type,
-- most common first.
--
-- Expected columns: payment_type, payment_count
-- Expected order: payment_count DESC
--
-- Before you write this, run a plain
--   SELECT DISTINCT payment_type FROM order_payments;
-- and actually look at the results. This dataset isn't clean -- decide what
-- you need to do about that before grouping, not after your counts look
-- suspiciously high.

SELECT
    LOWER(TRIM(payment_type)) AS payment_type,
    COUNT(*) AS payment_count
FROM order_payments
GROUP BY
    LOWER(TRIM(payment_type))
ORDER BY
    payment_count DESC;
