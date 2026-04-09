import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ─── status buckets ──────────────────────────────────────────────────────────
const PURCHASE_ALL = [
  'pending_purchase','ordered','goods_arrived','inspecting',
  'goods_inspected','exception_reported','completed','terminated',
];
const PURCHASE_ACTIVE = [
  'pending_purchase','ordered','goods_arrived','inspecting',
  'goods_inspected','exception_reported',
];
const PENDING_ANALYSIS = ['draft','pending_info','pending_analysis'];

function pgList(arr: string[]): string {
  return arr.map(s => `'${s}'`).join(',');
}

// ─── GET /api/stats/overview ──────────────────────────────────────────────────
router.get("/stats/overview", async (_req, res) => {
  try {
    const [summary, stageRows, funnelRow] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                                    AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS this_week,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS this_month,
          COUNT(*) FILTER (WHERE status IN (${pgList(PURCHASE_ACTIVE)}))::int    AS in_purchase,
          COUNT(*) FILTER (WHERE status = 'completed' OR completed_at IS NOT NULL)::int AS completed,
          COUNT(*) FILTER (WHERE anomaly_reported_at IS NOT NULL)::int          AS exception_count
        FROM products
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM products
        GROUP BY status
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_entry,
          COUNT(*) FILTER (WHERE analysis_submitted_at IS NOT NULL)::int  AS submitted_analysis,
          COUNT(*) FILTER (WHERE sampling_started_at IS NOT NULL)::int    AS entered_sampling,
          COUNT(*) FILTER (WHERE manager_reviewed_at IS NOT NULL)::int    AS manager_decided,
          COUNT(*) FILTER (WHERE status IN (${pgList(PURCHASE_ALL)}))::int AS entered_purchase,
          COUNT(*) FILTER (WHERE status = 'completed' OR completed_at IS NOT NULL)::int AS completed
        FROM products
      `),
    ]);

    res.json({
      summary:           summary.rows[0],
      stageDistribution: stageRows.rows,
      funnel:            funnelRow.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Overview stats failed", detail: String(err) });
  }
});

// ─── GET /api/stats/process ───────────────────────────────────────────────────
router.get("/stats/process", async (_req, res) => {
  try {
    const [bottlenecks, timing, overdueAnalysis, overdueDecision, overduePurchase] =
      await Promise.all([
        pool.query(`
          SELECT status, COUNT(*)::int AS count
          FROM products
          WHERE status NOT IN ('completed','terminated','rejected')
          GROUP BY status
          ORDER BY count DESC
        `),
        pool.query(`
          SELECT
            ROUND(AVG(EXTRACT(EPOCH FROM (analysis_submitted_at - created_at))/86400)::numeric, 1)
              AS avg_days_to_analysis,
            COUNT(*) FILTER (WHERE analysis_submitted_at IS NOT NULL)::int
              AS n_to_analysis,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (sampling_started_at - analysis_submitted_at))/86400)
                FILTER (WHERE analysis_submitted_at IS NOT NULL AND sampling_started_at IS NOT NULL)::numeric, 1
            ) AS avg_days_to_sampling,
            COUNT(*) FILTER (WHERE analysis_submitted_at IS NOT NULL AND sampling_started_at IS NOT NULL)::int
              AS n_to_sampling,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (manager_reviewed_at - sampling_started_at))/86400)
                FILTER (WHERE sampling_started_at IS NOT NULL AND manager_reviewed_at IS NOT NULL)::numeric, 1
            ) AS avg_days_to_decision,
            COUNT(*) FILTER (WHERE sampling_started_at IS NOT NULL AND manager_reviewed_at IS NOT NULL)::int
              AS n_to_decision,
            ROUND(
              AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/86400)
                FILTER (WHERE ordered_at IS NOT NULL AND completed_at IS NOT NULL)::numeric, 1
            ) AS avg_days_to_complete,
            COUNT(*) FILTER (WHERE ordered_at IS NOT NULL AND completed_at IS NOT NULL)::int
              AS n_to_complete
          FROM products
        `),
        pool.query(`
          SELECT id, product_name, status, created_at
          FROM products
          WHERE status IN (${pgList(PENDING_ANALYSIS)})
            AND created_at < NOW() - INTERVAL '3 days'
          ORDER BY created_at ASC
          LIMIT 20
        `),
        pool.query(`
          SELECT id, product_name, status, sampling_started_at
          FROM products
          WHERE sampling_started_at IS NOT NULL
            AND manager_reviewed_at IS NULL
            AND status NOT IN ('rejected','completed','terminated')
            AND sampling_started_at < NOW() - INTERVAL '7 days'
          ORDER BY sampling_started_at ASC
          LIMIT 20
        `),
        pool.query(`
          SELECT id, product_name, status, ordered_at
          FROM products
          WHERE ordered_at IS NOT NULL
            AND completed_at IS NULL
            AND status NOT IN ('terminated','rejected','completed')
            AND ordered_at < NOW() - INTERVAL '14 days'
          ORDER BY ordered_at ASC
          LIMIT 20
        `),
      ]);

    res.json({
      bottlenecks:      bottlenecks.rows,
      timing:           timing.rows[0],
      overdueAnalysis:  overdueAnalysis.rows,
      overdueDecision:  overdueDecision.rows,
      overduePurchase:  overduePurchase.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Process stats failed", detail: String(err) });
  }
});

// ─── GET /api/stats/review ────────────────────────────────────────────────────
router.get("/stats/review", async (_req, res) => {
  try {
    const [categories, suppliers, anomaly, skus] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(ai_category),''), NULLIF(TRIM(category_guess),''), '未分类') AS category,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status IN (${pgList(PURCHASE_ALL)}))::int   AS entered_purchase,
          COUNT(*) FILTER (WHERE status = 'completed' OR completed_at IS NOT NULL)::int AS completed,
          COUNT(*) FILTER (WHERE anomaly_reported_at IS NOT NULL)::int       AS exceptions
        FROM products
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 30
      `),
      pool.query(`
        SELECT
          so.supplier_name,
          COUNT(*)::int AS total_options,
          COUNT(*) FILTER (WHERE so.selected_at IS NOT NULL)::int                                  AS selected_count,
          COUNT(*) FILTER (WHERE p.status IN (${pgList(PURCHASE_ALL)}))::int                       AS purchase_count,
          COUNT(*) FILTER (WHERE p.status = 'completed' OR p.completed_at IS NOT NULL)::int        AS completed_count,
          COUNT(*) FILTER (WHERE p.anomaly_reported_at IS NOT NULL)::int                           AS anomaly_count
        FROM sample_options so
        LEFT JOIN products p ON p.id = so.product_id
        WHERE so.supplier_name IS NOT NULL AND TRIM(so.supplier_name) != ''
        GROUP BY so.supplier_name
        ORDER BY total_options DESC
        LIMIT 30
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_exceptions,
          COUNT(*) FILTER (WHERE anomaly_handling_method = 'accept')::int    AS accepted,
          COUNT(*) FILTER (WHERE anomaly_handling_method = 'reorder')::int   AS reordered,
          COUNT(*) FILTER (WHERE anomaly_handling_method = 'terminate')::int AS terminated,
          COUNT(*) FILTER (WHERE anomaly_handling_method IS NULL)::int       AS pending_handling
        FROM products
        WHERE anomaly_reported_at IS NOT NULL
      `),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_skus,
          COUNT(*) FILTER (WHERE manager_selected = true)::int  AS selected_skus,
          COUNT(*) FILTER (WHERE manager_selected IS NOT TRUE)::int AS unselected_skus
        FROM sample_sku_lines
      `),
    ]);

    res.json({
      categories:    categories.rows,
      suppliers:     suppliers.rows,
      anomalySummary: anomaly.rows[0],
      skuStats:      skus.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Review stats failed", detail: String(err) });
  }
});

export default router;
