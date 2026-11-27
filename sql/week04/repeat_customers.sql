-- Widget: "Repeat customers" table.
--
-- Write a query that returns the 20 customers who've placed the most
-- orders, with their name and how many orders they've placed.
--
-- Expected columns: customer_unique_id, customer_name, order_count
-- Expected order: order_count DESC, then customer_unique_id ASC to break ties
-- Expected row count: 20 -- use FETCH FIRST 20 ROWS ONLY (not LIMIT). With
-- tens of thousands of real customers, "every repeat customer" would be a
-- very long list -- this widget only needs the top 20.
--
-- Before you write this: look closely at the `customers` table. There are
-- two id columns for a reason -- read the comment in db/schema.sql (or just
-- run a query) to understand what customer_id actually identifies here, and
-- which column identifies the same real person across multiple orders.
-- Grouping by the wrong one will run fine and give you a wrong, too-small
-- answer -- it won't error, so you have to actually check it makes sense.
-- customer_name is one name per real person (per customer_unique_id), so
-- you'll need it in your GROUP BY alongside customer_unique_id.

SELECT
    c.customer_unique_id,
    c.customer_name,
    COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o
    ON c.customer_id = o.customer_id
GROUP BY
    c.customer_unique_id,
    c.customer_name
ORDER BY
    order_count DESC,
    c.customer_unique_id ASC
FETCH FIRST 20 ROWS ONLY;
