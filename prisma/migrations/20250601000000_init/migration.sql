-- BazionWeb — Initial Schema Migration
-- Generated from: prisma/schema.prisma
-- Version: 20250601000000_init
-- DO NOT EDIT MANUALLY — managed by Prisma Migrate

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CLIENT');
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'TRIAL');
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ON_HOLD');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "HostingStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PROVISIONING', 'MIGRATING', 'DECOMMISSIONED');
CREATE TYPE "TicketPriority" AS ENUM ('P1', 'P2', 'P3', 'P4');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_CLIENT', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketCategory" AS ENUM ('HOSTING', 'DEVELOPMENT', 'MAINTENANCE', 'SECURITY', 'BILLING', 'PERFORMANCE', 'OTHER');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "BackupType" AS ENUM ('DAILY_INCREMENTAL', 'WEEKLY_FULL', 'MONTHLY_ARCHIVE', 'MANUAL');
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'VERIFIED');
CREATE TYPE "NotificationType" AS ENUM ('SSL_EXPIRY', 'BACKUP_FAILURE', 'DOWNTIME_ALERT', 'TICKET_UPDATE', 'INVOICE_DUE', 'RENEWAL_REMINDER', 'SECURITY_ALERT', 'SYSTEM');

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "email"         TEXT         NOT NULL,
    "role"          "UserRole"   NOT NULL DEFAULT 'CLIENT',
    "keycloak_id"   TEXT         NOT NULL,
    "first_name"    TEXT,
    "last_name"     TEXT,
    "phone"         TEXT,
    "avatar_url"    TEXT,
    "mfa_enabled"   BOOLEAN      NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"    TIMESTAMPTZ,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key"        ON "users"("email");
CREATE UNIQUE INDEX "users_keycloak_id_key"  ON "users"("keycloak_id");
CREATE INDEX "users_email_idx"               ON "users"("email");
CREATE INDEX "users_keycloak_id_idx"         ON "users"("keycloak_id");
CREATE INDEX "users_deleted_at_idx"          ON "users"("deleted_at");

-- ── plans ────────────────────────────────────────────────────────────────────

CREATE TABLE "plans" (
    "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"                  TEXT        NOT NULL,
    "tier"                  "PlanTier"  NOT NULL,
    "price_monthly"         DECIMAL(10,2) NOT NULL,
    "price_annual"          DECIMAL(10,2) NOT NULL,
    "uptime_sla"            TEXT        NOT NULL,
    "p1_response_minutes"   INTEGER     NOT NULL,
    "p2_response_minutes"   INTEGER     NOT NULL,
    "p3_response_minutes"   INTEGER     NOT NULL,
    "max_backup_retention"  INTEGER     NOT NULL,
    "has_maintenance"       BOOLEAN     NOT NULL DEFAULT false,
    "has_security_mgmt"     BOOLEAN     NOT NULL DEFAULT false,
    "has_performance_opt"   BOOLEAN     NOT NULL DEFAULT false,
    "has_unlimited_updates" BOOLEAN     NOT NULL DEFAULT false,
    "has_dedicated_am"      BOOLEAN     NOT NULL DEFAULT false,
    "has_custom_sla"        BOOLEAN     NOT NULL DEFAULT false,
    "max_service_cred_pct"  INTEGER     NOT NULL DEFAULT 5,
    "is_active"             BOOLEAN     NOT NULL DEFAULT true,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- ── clients ──────────────────────────────────────────────────────────────────

CREATE TABLE "clients" (
    "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
    "user_id"       UUID           NOT NULL,
    "business_name" TEXT           NOT NULL,
    "contact_name"  TEXT           NOT NULL,
    "email"         TEXT           NOT NULL,
    "phone"         TEXT,
    "address"       TEXT,
    "country"       TEXT           NOT NULL DEFAULT 'KE',
    "plan_id"       UUID           NOT NULL,
    "status"        "ClientStatus" NOT NULL DEFAULT 'TRIAL',
    "onboarded_at"  TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "deleted_at"    TIMESTAMPTZ,
    CONSTRAINT "clients_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "clients_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clients_plan_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clients_user_id_key" ON "clients"("user_id");
CREATE UNIQUE INDEX "clients_email_key"   ON "clients"("email");
CREATE INDEX "clients_plan_id_idx"        ON "clients"("plan_id");
CREATE INDEX "clients_status_idx"         ON "clients"("status");
CREATE INDEX "clients_deleted_at_idx"     ON "clients"("deleted_at");

-- ── projects ─────────────────────────────────────────────────────────────────

CREATE TABLE "projects" (
    "id"              UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"       UUID            NOT NULL,
    "name"            TEXT            NOT NULL,
    "description"     TEXT,
    "status"          "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "completion_pct"  INTEGER         NOT NULL DEFAULT 0,
    "start_date"      TIMESTAMPTZ,
    "due_date"        TIMESTAMPTZ,
    "completed_at"    TIMESTAMPTZ,
    "staging_url"     TEXT,
    "production_url"  TEXT,
    "created_at"      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "deleted_at"      TIMESTAMPTZ,
    CONSTRAINT "projects_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "projects_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "projects_client_id_idx"  ON "projects"("client_id");
CREATE INDEX "projects_status_idx"     ON "projects"("status");
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- ── project_tasks ─────────────────────────────────────────────────────────────

CREATE TABLE "project_tasks" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "project_id"   UUID           NOT NULL,
    "title"        TEXT           NOT NULL,
    "description"  TEXT,
    "status"       "TaskStatus"   NOT NULL DEFAULT 'TODO',
    "priority"     "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_id"  UUID,
    "due_date"     TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "sort_order"   INTEGER        NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT "project_tasks_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "project_tasks_project_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "project_tasks_project_id_idx"  ON "project_tasks"("project_id");
CREATE INDEX "project_tasks_assignee_id_idx" ON "project_tasks"("assignee_id");
CREATE INDEX "project_tasks_status_idx"      ON "project_tasks"("status");

-- ── hosting_accounts ──────────────────────────────────────────────────────────

CREATE TABLE "hosting_accounts" (
    "id"           UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"    UUID            NOT NULL,
    "domain"       TEXT            NOT NULL,
    "server"       TEXT            NOT NULL,
    "plan"         TEXT            NOT NULL,
    "ssl_expiry"   TIMESTAMPTZ,
    "ssl_issuer"   TEXT,
    "status"       "HostingStatus" NOT NULL DEFAULT 'PROVISIONING',
    "disk_usage_mb" INTEGER,
    "bandwidth_gb"  DECIMAL(10,2),
    "ip_address"   TEXT,
    "server_os"    TEXT,
    "php_version"  TEXT,
    "created_at"   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "deleted_at"   TIMESTAMPTZ,
    CONSTRAINT "hosting_accounts_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "hosting_accounts_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "hosting_accounts_domain_key"      ON "hosting_accounts"("domain");
CREATE INDEX "hosting_accounts_client_id_idx"          ON "hosting_accounts"("client_id");
CREATE INDEX "hosting_accounts_ssl_expiry_idx"         ON "hosting_accounts"("ssl_expiry");
CREATE INDEX "hosting_accounts_deleted_at_idx"         ON "hosting_accounts"("deleted_at");

-- ── subscriptions ─────────────────────────────────────────────────────────────

CREATE TABLE "subscriptions" (
    "id"             UUID                 NOT NULL DEFAULT gen_random_uuid(),
    "client_id"      UUID                 NOT NULL,
    "plan_id"        UUID                 NOT NULL,
    "billing_cycle"  "BillingCycle"       NOT NULL DEFAULT 'MONTHLY',
    "status"         "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date"     TIMESTAMPTZ          NOT NULL,
    "renewal_date"   TIMESTAMPTZ          NOT NULL,
    "cancelled_at"   TIMESTAMPTZ,
    "discount_pct"   INTEGER              NOT NULL DEFAULT 0,
    "notes"          TEXT,
    "created_at"     TIMESTAMPTZ          NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ          NOT NULL DEFAULT now(),
    CONSTRAINT "subscriptions_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_plan_fk"   FOREIGN KEY ("plan_id")   REFERENCES "plans"("id")   ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "subscriptions_client_id_idx"   ON "subscriptions"("client_id");
CREATE INDEX "subscriptions_plan_id_idx"     ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_renewal_date_idx" ON "subscriptions"("renewal_date");

-- ── invoices ──────────────────────────────────────────────────────────────────

CREATE TABLE "invoices" (
    "id"              UUID            NOT NULL DEFAULT gen_random_uuid(),
    "client_id"       UUID            NOT NULL,
    "subscription_id" UUID,
    "invoice_number"  TEXT            NOT NULL,
    "amount"          DECIMAL(10,2)   NOT NULL,
    "currency"        TEXT            NOT NULL DEFAULT 'USD',
    "status"          "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date"        TIMESTAMPTZ     NOT NULL,
    "paid_at"         TIMESTAMPTZ,
    "pdf_url"         TEXT,
    "line_items"      JSONB,
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT "invoices_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "invoices_client_fk"       FOREIGN KEY ("client_id")       REFERENCES "clients"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_subscription_fk" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_client_id_idx"             ON "invoices"("client_id");
CREATE INDEX "invoices_subscription_id_idx"       ON "invoices"("subscription_id");
CREATE INDEX "invoices_status_idx"                ON "invoices"("status");
CREATE INDEX "invoices_due_date_idx"              ON "invoices"("due_date");

-- ── tickets ───────────────────────────────────────────────────────────────────

CREATE TABLE "tickets" (
    "id"          UUID             NOT NULL DEFAULT gen_random_uuid(),
    "client_id"   UUID             NOT NULL,
    "subject"     TEXT             NOT NULL,
    "priority"    "TicketPriority" NOT NULL DEFAULT 'P3',
    "status"      "TicketStatus"   NOT NULL DEFAULT 'OPEN',
    "category"    "TicketCategory" NOT NULL DEFAULT 'OTHER',
    "assigned_to" UUID,
    "resolved_at" TIMESTAMPTZ,
    "closed_at"   TIMESTAMPTZ,
    "sla_breached" BOOLEAN         NOT NULL DEFAULT false,
    "created_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT "tickets_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "tickets_client_fk"  FOREIGN KEY ("client_id")   REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_assignee_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "tickets_client_id_idx"   ON "tickets"("client_id");
CREATE INDEX "tickets_assigned_to_idx" ON "tickets"("assigned_to");
CREATE INDEX "tickets_status_idx"      ON "tickets"("status");
CREATE INDEX "tickets_priority_idx"    ON "tickets"("priority");

-- ── ticket_comments ───────────────────────────────────────────────────────────

CREATE TABLE "ticket_comments" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id"   UUID        NOT NULL,
    "author_id"   UUID        NOT NULL,
    "body"        TEXT        NOT NULL,
    "is_internal" BOOLEAN     NOT NULL DEFAULT false,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "ticket_comments_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "ticket_comments_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_comments_author_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id")   ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments"("ticket_id");
CREATE INDEX "ticket_comments_author_id_idx" ON "ticket_comments"("author_id");

-- ── backups ───────────────────────────────────────────────────────────────────

CREATE TABLE "backups" (
    "id"                  UUID           NOT NULL DEFAULT gen_random_uuid(),
    "hosting_account_id"  UUID           NOT NULL,
    "type"                "BackupType"   NOT NULL,
    "status"              "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "size_mb"             DECIMAL(10,2),
    "storage_path"        TEXT,
    "storage_bucket"      TEXT,
    "checksum"            TEXT,
    "verified_at"         TIMESTAMPTZ,
    "expires_at"          TIMESTAMPTZ,
    "error_message"       TEXT,
    "created_at"          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT "backups_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "backups_hosting_fk" FOREIGN KEY ("hosting_account_id") REFERENCES "hosting_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "backups_hosting_account_id_idx" ON "backups"("hosting_account_id");
CREATE INDEX "backups_status_idx"             ON "backups"("status");
CREATE INDEX "backups_created_at_idx"         ON "backups"("created_at");

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Append-only: no UPDATE or DELETE permitted at application layer

CREATE TABLE "audit_logs" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"       UUID,
    "action"        TEXT        NOT NULL,
    "resource_type" TEXT        NOT NULL,
    "resource_id"   TEXT,
    "old_value"     JSONB,
    "new_value"     JSONB,
    "ip_address"    TEXT,
    "user_agent"    TEXT,
    "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "audit_logs_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_user_id_idx"          ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_resource_idx"         ON "audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_timestamp_idx"        ON "audit_logs"("timestamp");

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE "notifications" (
    "id"         UUID                 NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID                 NOT NULL,
    "type"       "NotificationType"   NOT NULL,
    "title"      TEXT                 NOT NULL,
    "message"    TEXT                 NOT NULL,
    "read"       BOOLEAN              NOT NULL DEFAULT false,
    "action_url" TEXT,
    "metadata"   JSONB,
    "created_at" TIMESTAMPTZ          NOT NULL DEFAULT now(),
    CONSTRAINT "notifications_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_read_idx"    ON "notifications"("read");

-- ── Prisma migration metadata ─────────────────────────────────────────────────

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid(),
    'bazionweb_init_checksum_v1',
    now(),
    '20250601000000_init',
    NULL,
    NULL,
    now(),
    1
) ON CONFLICT DO NOTHING;
