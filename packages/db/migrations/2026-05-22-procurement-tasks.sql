CREATE TABLE IF NOT EXISTS procurement_tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text,
  detail text NOT NULL,
  reference_image_url text,
  reference_link text,
  assignee_mode text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'published',
  created_by_id text,
  created_by_name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  published_at timestamp,
  closed_at timestamp
);

CREATE TABLE IF NOT EXISTS procurement_task_assignees (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  employee_id text NOT NULL,
  employee_name text,
  assigned_at timestamp NOT NULL DEFAULT now(),
  read_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_task_assignees_task_employee_uq
  ON procurement_task_assignees (task_id, employee_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS task_id text;
CREATE INDEX IF NOT EXISTS products_task_id_idx ON products (task_id);
