import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  DEFAULT_TENANT_SLUG: z.string().min(1).default("demo-salon"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "STRIPE_SECRET_KEY must start with sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_"),
  STRIPE_PRICE_STARTER: z.string().startsWith("price_", "STRIPE_PRICE_STARTER must start with price_"),
  STRIPE_PRICE_PRO: z.string().startsWith("price_", "STRIPE_PRICE_PRO must start with price_"),
  STRIPE_PRICE_BUSINESS: z.string().startsWith("price_", "STRIPE_PRICE_BUSINESS must start with price_"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;