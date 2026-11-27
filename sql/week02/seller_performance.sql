-- Widget: "Seller performance" table.
--
-- Write a query that returns each seller's number of order_items sold and
-- their average review score across all reviews for orders containing their
-- items. Only include sellers with at least 2 items sold.
--
-- Expected columns: seller_id, seller_name, items_sold, avg_review_score
-- Expected order: items_sold DESC

SELECT
    s.seller_id,
    s.seller_name,
    COUNT(oi.order_item_id) AS items_sold,
    ROUND(AVG(r.review_score), 2) AS avg_review_score
FROM sellers s
JOIN order_items oi
    ON s.seller_id = oi.seller_id
JOIN order_reviews r
    ON oi.order_id = r.order_id
GROUP BY
    s.seller_id,
    s.seller_name
HAVING
    COUNT(oi.order_item_id) >= 2
ORDER BY
    items_sold DESC;
