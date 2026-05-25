ALTER TABLE sample_sku_lines
  ADD COLUMN IF NOT EXISTS anomaly_history jsonb NOT NULL DEFAULT '[]'::jsonb;
