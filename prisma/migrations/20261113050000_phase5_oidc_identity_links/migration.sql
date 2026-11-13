-- CreateTable
CREATE TABLE "oidc_identity_links" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" TEXT,
    "email" TEXT,
    "claim_method" TEXT NOT NULL DEFAULT 'EXPLICIT_CLAIM_TOKEN',
    "linked_by" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "oidc_identity_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oidc_identity_links_user_id_key" ON "oidc_identity_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oidc_identity_links_client_id_key" ON "oidc_identity_links"("client_id");

-- CreateIndex
CREATE INDEX "oidc_identity_links_user_id_idx" ON "oidc_identity_links"("user_id");

-- CreateIndex
CREATE INDEX "oidc_identity_links_client_id_idx" ON "oidc_identity_links"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oidc_identity_links_issuer_subject_key" ON "oidc_identity_links"("issuer", "subject");

-- AddForeignKey
ALTER TABLE "oidc_identity_links" ADD CONSTRAINT "oidc_identity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oidc_identity_links" ADD CONSTRAINT "oidc_identity_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

