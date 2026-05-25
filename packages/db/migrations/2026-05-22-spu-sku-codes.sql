CREATE TABLE IF NOT EXISTS spu_code_counters (
  period text PRIMARY KEY,
  current_sequence integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS spu_code text,
  ADD COLUMN IF NOT EXISTS spu_code_period text,
  ADD COLUMN IF NOT EXISTS spu_code_sequence integer,
  ADD COLUMN IF NOT EXISTS spu_code_assigned_at timestamp;

ALTER TABLE sample_sku_lines
  ADD COLUMN IF NOT EXISTS sku_code text,
  ADD COLUMN IF NOT EXISTS sku_code_suffix integer,
  ADD COLUMN IF NOT EXISTS sku_code_assigned_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS products_spu_code_unique
  ON products (spu_code)
  WHERE spu_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sample_sku_lines_sku_code_unique
  ON sample_sku_lines (sku_code)
  WHERE sku_code IS NOT NULL;
