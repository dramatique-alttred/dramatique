-- AlterTable
ALTER TABLE "series" ADD COLUMN     "default_coin_price" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "lock_from_episode" INTEGER NOT NULL DEFAULT 1;


-- Backfill from existing episodes: lock point = first paywalled episode
-- (or one past the last episode if everything is free); default price =
-- that episode's coin price.
UPDATE "series" s SET
  "lock_from_episode" = COALESCE(
    (SELECT MIN(e."episode_number") FROM "episodes" e WHERE e."series_id" = s."id" AND e."access_type" <> 'FREE'),
    (SELECT COALESCE(MAX(e."episode_number"), 0) + 1 FROM "episodes" e WHERE e."series_id" = s."id")
  ),
  "default_coin_price" = COALESCE(
    (SELECT e."coin_price" FROM "episodes" e WHERE e."series_id" = s."id" AND e."access_type" = 'COIN_LOCKED' ORDER BY e."episode_number" LIMIT 1),
    5
  );
