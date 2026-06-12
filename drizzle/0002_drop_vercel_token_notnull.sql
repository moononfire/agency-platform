CREATE TYPE "public"."product_type" AS ENUM('hair', 'courses');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "vercel_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "type" "product_type" DEFAULT 'hair' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_secret_key" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_publishable_key" text;