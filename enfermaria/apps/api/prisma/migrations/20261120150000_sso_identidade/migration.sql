-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "ssoProviderId" TEXT,
ADD COLUMN     "ssoSubject" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_ssoProviderId_ssoSubject_key" ON "utilizadores"("ssoProviderId", "ssoSubject");

