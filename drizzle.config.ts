import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // マイグレーションはプーラーを通さない直結 URL で実行する
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
