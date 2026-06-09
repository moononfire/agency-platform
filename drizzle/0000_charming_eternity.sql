CREATE TYPE "public"."tenant_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vercel_project_id" text NOT NULL,
	"vercel_token" text NOT NULL,
	"base_domain" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_onboardings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"current_step" text DEFAULT '1',
	"completed_at" timestamp,
	"dns_verified" boolean DEFAULT false,
	"dns_verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"slug" text NOT NULL,
	"custom_domain" text,
	"status" "tenant_status" DEFAULT 'pending',
	"schema_version" text DEFAULT '1',
	"business_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"logo_url" text,
	"primary_color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tenant_onboardings" ADD CONSTRAINT "tenant_onboardings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;