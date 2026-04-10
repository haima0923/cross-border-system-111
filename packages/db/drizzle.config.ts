import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/products.ts",
    "./src/schema/purchase_order_lines.ts",
    "./src/schema/purchase_orders.ts",
    "./src/schema/sample_options.ts",
    "./src/schema/sample_sku_lines.ts",
    "./src/schema/users.ts"
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});