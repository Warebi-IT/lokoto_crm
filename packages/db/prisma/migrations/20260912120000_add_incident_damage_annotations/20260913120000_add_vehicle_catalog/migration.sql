CREATE TABLE "vehicleCatalog" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "seats" INTEGER,
    "fuelType" "FuelType",
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'vpic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicleCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicleCatalog_make_model_key" ON "vehicleCatalog"("make", "model");
CREATE INDEX "vehicleCatalog_make_idx" ON "vehicleCatalog"("make");
CREATE INDEX "vehicleCatalog_model_idx" ON "vehicleCatalog"("model");
