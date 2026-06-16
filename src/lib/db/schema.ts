import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending",
  "active",
  "suspended",
]);

export const products = pgTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  vercelProjectId: text("vercel_project_id").notNull(),
  vercelToken: text("vercel_token"),
  baseDomain: text("base_domain").notNull(),
  appUrl: text("app_url").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  slug: text("slug").notNull(),
  customDomain: text("custom_domain"),
  status: tenantStatusEnum("status").default("pending"),
  schemaVersion: text("schema_version").default("1"),
  businessName: text("business_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  stripeSecretKey: text("stripe_secret_key"),
  stripePublishableKey: text("stripe_publishable_key"),
  stripeAccountId: text("stripe_account_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantOnboardings = pgTable("tenant_onboardings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  currentStep: text("current_step").default("1"),
  completedAt: timestamp("completed_at"),
  dnsVerified: boolean("dns_verified").default(false),
  dnsVerifiedAt: timestamp("dns_verified_at"),
});
