-- CreateTable
CREATE TABLE "Badge" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "xp_required" INTEGER NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);
