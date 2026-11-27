-- Widget: "Seller leaderboard by state" table.
--
-- For each seller, compute their total revenue (sum of order_items.price)
-- and their RANK() within their own seller_state, ordered by revenue
-- descending. Only show the top 3 sellers per state.
--
-- Expected columns: seller_id, seller_name, seller_state, total_revenue, state_rank
-- Expected order: seller_state ASC, state_rank ASC

WITH seller_rev AS (
    SELECT
        s.seller_id,
        s.seller_name,
        s.seller_state,
        SUM(oi.price) AS total_revenue,
        RANK() OVER (
            PARTITION BY s.seller_state
            ORDER BY SUM(oi.price) DESC
        ) AS state_rank
    FROM sellers s
    JOIN order_items oi
        ON s.seller_id = oi.seller_id
    GROUP BY
        s.seller_id,
        s.seller_name,
        s.seller_state
)
SELECT
    seller_id,
    seller_name,
    seller_state,
    total_revenue,
    state_rank
FROM seller_rev
WHERE state_rank <= 3
ORDER BY
    seller_state ASC,
    state_rank ASC;
