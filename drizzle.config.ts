import { defineConfig } from "drizzle-kit";

// db:generate works offline; db:migrate/db:studio need DATABASE_URL (see .env.example).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Asserted, not defaulted: a missing DATABASE_URL should fail loudly at
    // migrate/studio time instead of dialing an empty connection string.
    url: process.env.DATABASE_URL!,
  },
});
