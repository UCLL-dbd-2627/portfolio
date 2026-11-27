-- Widget: "Farthest shipments" table -- the 10 orders that traveled the
-- longest distance from seller to customer.
--
-- The `geolocation` table maps zip_code_prefix -> lat/lng -- but NOT
-- one-to-one. Each zip prefix has multiple sampled rows (real GPS pings
-- within that area), so joining straight from orders to geolocation would
-- multiply every order's rows by however many geolocation samples share
-- that zip -- silently wrong, not an error. Use a CTE to collapse
-- geolocation down to one row per zip prefix FIRST (its average lat/lng is
-- fine), THEN join orders to that clean version. This is the textbook case
-- for a CTE: not because a subquery couldn't do it, but because naming the
-- intermediate step makes the "one row per zip" invariant explicit instead
-- of silently assumed three joins later.
--
-- Distance: use the haversine formula (great-circle distance on a sphere).
-- In Postgres:
--   6371 * acos(
--     cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2 - lng1))
--     + sin(radians(lat1)) * sin(radians(lat2))
--   )
-- gives distance in km, where 6371 is Earth's radius in km. Wrap the acos()
-- argument in LEAST(1.0, ...) -- floating-point rounding can occasionally
-- push it a hair above 1.0 for very short distances, which makes acos()
-- return NULL instead of ~0. Round the final result to 1 decimal place.
--
-- Some orders have multiple order_items (possibly from different sellers).
-- Pick exactly one seller per order for this -- DISTINCT ON (order_id) in a
-- CTE is a clean way to do that deterministically.
--
-- Expected columns: order_id, distance_km
-- Expected order: distance_km DESC
-- Expected row count: 10 -- FETCH FIRST 10 ROWS ONLY, not LIMIT.
--
-- Once this works: try EXPLAIN ANALYZE on it. geolocation is the largest
-- table in this schema by a wide margin -- not graded, but worth seeing
-- what a join against ~1M ungrouped rows actually costs, and whether an
-- index on geolocation's zip column changes anything.


WITH geo_avg AS (
    SELECT
        geolocation_zip_code_prefix,
        AVG(geolocation_lat) AS lat,
        AVG(geolocation_lng) AS lng
    FROM geolocation
    GROUP BY geolocation_zip_code_prefix
),
order_sellers AS (
    SELECT DISTINCT ON (order_id)
        order_id,
        seller_id
    FROM order_items
    ORDER BY order_id, seller_id
)
SELECT
    o.order_id,
    ROUND(
        (
            6371 * ACOS(
                LEAST(
                    1.0,
                    COS(RADIANS(gc.lat)) *
                    COS(RADIANS(gs.lat)) *
                    COS(RADIANS(gs.lng - gc.lng)) +
                    SIN(RADIANS(gc.lat)) *
                    SIN(RADIANS(gs.lat))
                )
            )
        )::numeric,
        1
    ) AS distance_km
FROM orders o
JOIN customers c
    ON o.customer_id = c.customer_id
JOIN order_sellers oi
    ON o.order_id = oi.order_id
JOIN sellers s
    ON oi.seller_id = s.seller_id
JOIN geo_avg gc
    ON c.customer_zip_code_prefix = gc.geolocation_zip_code_prefix
JOIN geo_avg gs
    ON s.seller_zip_code_prefix = gs.geolocation_zip_code_prefix
ORDER BY distance_km DESC
FETCH FIRST 10 ROWS ONLY;
