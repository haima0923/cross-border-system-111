CREATE INDEX IF NOT EXISTS idx_sample_options_product_id
  ON sample_options (product_id);

CREATE INDEX IF NOT EXISTS idx_sample_options_product_selected
  ON sample_options (product_id, selected_at);

CREATE INDEX IF NOT EXISTS idx_sample_sku_lines_option_id
  ON sample_sku_lines (sample_option_id);

CREATE INDEX IF NOT EXISTS idx_sample_sku_lines_option_manager_selected
  ON sample_sku_lines (sample_option_id, manager_selected);

CREATE INDEX IF NOT EXISTS idx_products_status_updated_at
  ON products (status, updated_at DESC);
