-- CreateTable
CREATE TABLE "checklists_cirurgia" (
    "id" TEXT NOT NULL,
    "cirurgiaId" TEXT NOT NULL,
    "signInEm" TIMESTAMP(3),
    "signInPorId" TEXT,
    "signInDados" JSONB,
    "timeOutEm" TIMESTAMP(3),
    "timeOutPorId" TEXT,
    "timeOutDados" JSONB,
    "signOutEm" TIMESTAMP(3),
    "signOutPorId" TEXT,
    "signOutDados" JSONB,

    CONSTRAINT "checklists_cirurgia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklists_cirurgia_cirurgiaId_key" ON "checklists_cirurgia"("cirurgiaId");

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_cirurgiaId_fkey" FOREIGN KEY ("cirurgiaId") REFERENCES "cirurgias_programadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_signInPorId_fkey" FOREIGN KEY ("signInPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_timeOutPorId_fkey" FOREIGN KEY ("timeOutPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists_cirurgia" ADD CONSTRAINT "checklists_cirurgia_signOutPorId_fkey" FOREIGN KEY ("signOutPorId") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
