-- Rename enum types to match application naming (UserRole, StockMovementType).
-- ALTER TYPE ... RENAME preserves the type object, so columns and indexes that
-- reference it follow automatically — no column drop/recreate, no data loss.
ALTER TYPE "Role" RENAME TO "UserRole";
ALTER TYPE "MovementType" RENAME TO "StockMovementType";
