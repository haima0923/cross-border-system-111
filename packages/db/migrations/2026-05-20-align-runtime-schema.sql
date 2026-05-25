ALTER TABLE products
  ADD COLUMN IF NOT EXISTS resubmitted boolean DEFAULT false;

ALTER TABLE sample_options
  ADD COLUMN IF NOT EXISTS shipping_cost numeric,
  ADD COLUMN IF NOT EXISTS sample_order_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sample_ordered_at timestamp,
  ADD COLUMN IF NOT EXISTS sample_review_started_at timestamp;

ALTER TABLE sample_sku_lines
  ADD COLUMN IF NOT EXISTS purchase_status text NOT NULL DEFAULT 'pending_purchase',
  ADD COLUMN IF NOT EXISTS ordered_at timestamp,
  ADD COLUMN IF NOT EXISTS arrived_at timestamp,
  ADD COLUMN IF NOT EXISTS inspecting_started_at timestamp,
  ADD COLUMN IF NOT EXISTS passed_at timestamp,
  ADD COLUMN IF NOT EXISTS completed_at timestamp,
  ADD COLUMN IF NOT EXISTS anomaly_type text,
  ADD COLUMN IF NOT EXISTS anomaly_note text,
  ADD COLUMN IF NOT EXISTS anomaly_reported_at timestamp,
  ADD COLUMN IF NOT EXISTS anomaly_reported_by text,
  ADD COLUMN IF NOT EXISTS anomaly_handling_method text,
  ADD COLUMN IF NOT EXISTS anomaly_handling_note text,
  ADD COLUMN IF NOT EXISTS anomaly_handled_by text,
  ADD COLUMN IF NOT EXISTS anomaly_handled_at timestamp,
  ADD COLUMN IF NOT EXISTS anomaly_resolved_at timestamp,
  ADD COLUMN IF NOT EXISTS anomaly_images jsonb,
  ADD COLUMN IF NOT EXISTS sku_consistent_with_image boolean,
  ADD COLUMN IF NOT EXISTS sku_material_eval text,
  ADD COLUMN IF NOT EXISTS sku_workmanship_eval text,
  ADD COLUMN IF NOT EXISTS sku_function_eval text,
  ADD COLUMN IF NOT EXISTS sku_remarks text,
  ADD COLUMN IF NOT EXISTS packing_quantity integer;
