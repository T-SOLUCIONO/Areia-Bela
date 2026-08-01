-- Guests sign in with an emailed link, never a password. Same shape as
-- PasswordResetToken: hashed, single-use, short-lived.
CREATE TABLE "GuestLoginToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestLoginToken_tokenHash_key" ON "GuestLoginToken"("tokenHash");
CREATE INDEX "GuestLoginToken_customerId_idx" ON "GuestLoginToken"("customerId");

ALTER TABLE "GuestLoginToken" ADD CONSTRAINT "GuestLoginToken_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
