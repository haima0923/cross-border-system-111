import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as products from "./schema/products";
import * as purchaseOrders from "./schema/purchase_orders";
import * as sampleOptions from "./schema/sample_options";
import * as sampleSkuLines from "./schema/sample_sku_lines";
import * as purchaseOrderLines from "./schema/purchase_order_lines";
import * as users from "./schema/users";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: {
    ...products,
    ...purchaseOrders,
    ...sampleOptions,
    ...sampleSkuLines,
    ...purchaseOrderLines,
    ...users,
  },
});

export { pool };

export * from "./schema/products";
export * from "./schema/purchase_orders";
export * from "./schema/sample_options";
export * from "./schema/sample_sku_lines";
export * from "./schema/purchase_order_lines";
export * from "./schema/users";