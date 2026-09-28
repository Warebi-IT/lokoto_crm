CREATE TYPE "ContactGender" AS ENUM ('H', 'F');

ALTER TABLE "contact"
ADD COLUMN "gender" "ContactGender" NOT NULL DEFAULT 'H';
