// Grading config. Each entry says how to check one widget.
//
// Plain query widgets: `expected` points at a fixture of the exact rows the
// reference solution returns (order matters -- the widget's ORDER BY is
// part of the spec).
//
// Action widgets: the widget itself is run once (with `params` if it takes
// any), then one or more `verify` queries check the resulting DB state
// against fixtures.
//
// `paramsQuery` (instead of `params`): a SELECT run fresh against whatever
// data is actually loaded, whose first row's columns become the params --
// use this instead of a hardcoded literal ID whenever the widget needs a
// REAL row to exist (a real customer, a real non-delivered order, ...).
// A literal ID only ever matches one specific dataset; a paramsQuery works
// against the small sample, the real ~99k dataset, or anything else. Any
// `:paramName` token in a `verify` entry's SQL gets substituted with the
// SAME resolved value the widget itself was called with.
//
// week08 widgets are run per role/param `case` -- same widget, different
// session, checked against a per-case fixture.
//
// Listed in week order -- this is also the order results render in on the
// dashboard's "Run full check" panel.

module.exports = [
  { week: "week01", id: "top_products", expected: "week01/top_products.json" },
  { week: "week01", id: "orders_by_city", expected: "week01/orders_by_city.json" },
  { week: "week01", id: "revenue_by_category", expected: "week01/revenue_by_category.json" },

  {
    week: "week02",
    id: "seller_performance",
    expected: "week02/seller_performance.json",
    // The question does not say how to round the average, so any valid rounding is accepted.
    roundingColumns: ["avg_review_score"],
    hint: "Hint: only order_items whose order has a review are counted (items without a review are left out), and the average may be rounded however you like.",
  },
  { week: "week02", id: "payment_method_breakdown", expected: "week02/payment_method_breakdown.json" },

  {
    week: "week03",
    id: "place_order",
    action: true,
    verify: [
      { sql: "SELECT order_id, customer_id, order_status FROM orders WHERE order_id = 'order_demo_001'", expected: "week03/order_after_place.json" },
      { sql: "SELECT order_item_id, product_id, seller_id FROM order_items WHERE order_id = 'order_demo_001' ORDER BY order_item_id", expected: "week03/items_after_place.json" },
    ],
  },

  { week: "week04", id: "no_review_customers", expected: "week04/no_review_customers.json" },
  { week: "week04", id: "repeat_customers", expected: "week04/repeat_customers.json" },
  { week: "week04", id: "farthest_shipments", expected: "week04/farthest_shipments.json", needsGeolocation: true },

  { week: "week05", id: "seller_leaderboard", expected: "week05/seller_leaderboard.json" },
  { week: "week05", id: "monthly_revenue_trend", expected: "week05/monthly_revenue_trend.json" },
  { week: "week05", id: "orders_page_two", expected: "week05/orders_page_two.json" },

  { week: "week06", id: "seller_summary_view", expected: "week06/seller_summary_view.json" },
  { week: "week06", id: "category_summary_view", expected: "week06/category_summary_view.json" },

  {
    week: "week08",
    id: "rls_role_switch",
    action: true,
    cases: [
      // A genuine repeat customer whose orders span MULTIPLE customer_id
      // values (not just multiple orders on the same one) -- this is what
      // actually discriminates a correct policy (joins through
      // customer_unique_id) from a naive one that filters directly on
      // customer_id, which would only show one of their orders and pass
      // unnoticed against a less careful test case. Resolved fresh each
      // run against whatever data is actually loaded.
      { paramsQuery: "SELECT c.customer_unique_id AS person_id, 'app_customer' AS role FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.customer_unique_id HAVING COUNT(DISTINCT o.customer_id) >= 2 ORDER BY c.customer_unique_id LIMIT 1", expected: "week08/customer_view.json" },
      // The most populous state -- a substantial but genuinely bounded
      // slice, not the whole table. Proves the district policy actually
      // filters (a naive USING (true) or a customer-only policy applied to
      // this role would both fail this differently than the real bug it's
      // meant to catch, but either way wouldn't match the expected count).
      { paramsQuery: "SELECT customer_state AS district, 'app_district_admin' AS role FROM customers GROUP BY customer_state ORDER BY COUNT(*) DESC LIMIT 1", countQuery: "SELECT LEAST(count(DISTINCT o.order_id), 50)::int AS n FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE c.customer_state = (SELECT customer_state FROM customers GROUP BY customer_state ORDER BY COUNT(*) DESC LIMIT 1)" },
      { params: { role: "app_admin", person_id: "" }, countQuery: "SELECT LEAST(count(*), 50)::int AS n FROM orders" },
    ],
  },
  {
    week: "week08",
    id: "rls_seller_view",
    action: true,
    cases: [
      { paramsQuery: "SELECT seller_id, 'app_seller' AS role FROM sellers ORDER BY seller_id LIMIT 1", expected: "week08/seller_view.json" },
    ],
  },

  {
    week: "week09",
    id: "process_refund",
    action: true,
    paramsQuery: "SELECT order_id FROM orders ORDER BY order_id LIMIT 1",
    verify: [
      { sql: "SELECT order_id, old_status, new_status FROM order_status_history WHERE order_id = :order_id ORDER BY changed_at", expected: "week09/audit_log_after_refund.json" },
      { sql: "SELECT order_id, order_status FROM orders WHERE order_id = :order_id", expected: "week09/order_after_refund.json" },
    ],
  },
  {
    week: "week09",
    id: "mark_delivered",
    action: true,
    // Must be an order that ISN'T already delivered/canceled, or the
    // trigger correctly has nothing to log (a real no-op, not a bug --
    // but a useless test case). Resolved fresh each run.
    paramsQuery: "SELECT order_id FROM orders WHERE order_status NOT IN ('delivered', 'canceled') ORDER BY order_id LIMIT 1",
    verify: [
      { sql: "SELECT order_id, old_status, new_status FROM order_status_history WHERE order_id = :order_id ORDER BY changed_at", expected: "week09/audit_log_after_delivery.json" },
      { sql: "SELECT order_id, order_status, order_delivered_customer_date IS NOT NULL AS has_delivery_date FROM orders WHERE order_id = :order_id", expected: "week09/order_after_delivery.json" },
    ],
  },

  { week: "week10", id: "priority_orders", expected: "week10/priority_orders.json" },
  { week: "week10", id: "loyalty_tiers", expected: "week10/loyalty_tiers.json" },
];
