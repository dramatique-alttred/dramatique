-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "EpisodeAccessType" AS ENUM ('FREE', 'COIN_LOCKED', 'VIP_ONLY');

-- CreateEnum
CREATE TYPE "UnlockMethod" AS ENUM ('COINS', 'AD', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('PURCHASE', 'EPISODE_UNLOCK', 'DAILY_REWARD', 'REFERRAL_BONUS', 'WELCOME_BONUS', 'AD_REWARD', 'ADMIN_ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('RAZORPAY', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('COIN_PACK', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_EPISODE', 'DAILY_CHECKIN', 'RESUME_REMINDER', 'VIP_EXPIRY', 'PROMO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" VARCHAR(128) NOT NULL,
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "display_name" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "referral_code" VARCHAR(16) NOT NULL,
    "vip_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_genre_preferences" (
    "user_id" UUID NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "user_genre_preferences_pkey" PRIMARY KEY ("user_id","genre_id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fcm_token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","type")
);

-- CreateTable
CREATE TABLE "daily_check_ins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "check_in_date" DATE NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "coins_awarded" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referee_id" UUID NOT NULL,
    "coins_awarded" INTEGER NOT NULL DEFAULT 0,
    "rewarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_reward_views" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "episode_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_reward_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(16),
    "color" VARCHAR(16),
    "description" VARCHAR(255),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(16),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "synopsis" TEXT,
    "thumbnail_url" VARCHAR(500) NOT NULL,
    "banner_url" VARCHAR(500),
    "trailer_key" VARCHAR(500),
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "category_id" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_vip_exclusive" BOOLEAN NOT NULL DEFAULT false,
    "release_year" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_genres" (
    "series_id" UUID NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "series_genres_pkey" PRIMARY KEY ("series_id","genre_id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "thumbnail_url" VARCHAR(500),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "access_type" "EpisodeAccessType" NOT NULL DEFAULT 'COIN_LOCKED',
    "coin_price" INTEGER NOT NULL DEFAULT 5,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "video_status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "source_key" VARCHAR(500),
    "hls_manifest_key" VARCHAR(500),
    "dash_manifest_key" VARCHAR(500),
    "subtitles_key" VARCHAR(500),
    "media_convert_job_id" VARCHAR(100),
    "video_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "excerpt" VARCHAR(500),
    "content" TEXT NOT NULL,
    "cover_url" VARCHAR(500),
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "author_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_unlocked_episodes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "method" "UnlockMethod" NOT NULL DEFAULT 'COINS',
    "coins_spent" INTEGER NOT NULL DEFAULT 0,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_unlocked_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_progress" (
    "user_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "last_position_seconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("user_id","episode_id")
);

-- CreateTable
CREATE TABLE "saved_series" (
    "user_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_series_pkey" PRIMARY KEY ("user_id","series_id")
);

-- CreateTable
CREATE TABLE "coin_wallets" (
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "type" "CoinTransactionType" NOT NULL,
    "description" VARCHAR(255),
    "reference_id" VARCHAR(100),
    "idempotency_key" VARCHAR(150),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_packs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "coins" INTEGER NOT NULL,
    "bonus_coins" INTEGER NOT NULL DEFAULT 0,
    "price_inr_paise" INTEGER NOT NULL,
    "price_usd_cents" INTEGER,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "price_inr_paise" INTEGER NOT NULL,
    "price_usd_cents" INTEGER,
    "razorpay_plan_id" VARCHAR(100),
    "stripe_price_id" VARCHAR(100),
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "gateway_subscription_id" VARCHAR(255) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "gateway_order_id" VARCHAR(255) NOT NULL,
    "gateway_payment_id" VARCHAR(255),
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount_minor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "coin_pack_id" INTEGER,
    "plan_id" INTEGER,
    "subscription_id" UUID,
    "coins_credited" INTEGER,
    "failure_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "deep_link" VARCHAR(500),
    "audience" VARCHAR(50) NOT NULL DEFAULT 'all',
    "sent_by_id" UUID,
    "sent_at" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_fcm_token_key" ON "user_devices"("fcm_token");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_check_ins_user_id_check_in_date_key" ON "daily_check_ins"("user_id", "check_in_date");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referee_id_key" ON "referrals"("referee_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- CreateIndex
CREATE INDEX "ad_reward_views_user_id_created_at_idx" ON "ad_reward_views"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_status_published_at_idx" ON "series"("status", "published_at");

-- CreateIndex
CREATE INDEX "series_status_publish_at_idx" ON "series"("status", "publish_at");

-- CreateIndex
CREATE INDEX "series_genres_genre_id_idx" ON "series_genres"("genre_id");

-- CreateIndex
CREATE INDEX "episodes_status_publish_at_idx" ON "episodes"("status", "publish_at");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_series_id_episode_number_key" ON "episodes"("series_id", "episode_number");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_unlocked_episodes_user_id_episode_id_key" ON "user_unlocked_episodes"("user_id", "episode_id");

-- CreateIndex
CREATE INDEX "watch_progress_user_id_updated_at_idx" ON "watch_progress"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "saved_series_user_id_created_at_idx" ON "saved_series"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "coin_transactions_idempotency_key_key" ON "coin_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_created_at_idx" ON "coin_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "coin_transactions_type_created_at_idx" ON "coin_transactions"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_razorpay_plan_id_key" ON "subscription_plans"("razorpay_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_stripe_price_id_key" ON "subscription_plans"("stripe_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_gateway_subscription_id_key" ON "subscriptions"("gateway_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_gateway_order_id_key" ON "payment_orders"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_gateway_payment_id_key" ON "payment_orders"("gateway_payment_id");

-- CreateIndex
CREATE INDEX "payment_orders_user_id_created_at_idx" ON "payment_orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_orders_status_created_at_idx" ON "payment_orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_gateway_event_id_key" ON "webhook_events"("gateway", "event_id");

-- AddForeignKey
ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "user_genre_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_genre_preferences" ADD CONSTRAINT "user_genre_preferences_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_check_ins" ADD CONSTRAINT "daily_check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_fkey" FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_reward_views" ADD CONSTRAINT "ad_reward_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_reward_views" ADD CONSTRAINT "ad_reward_views_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "genres" ADD CONSTRAINT "genres_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_genres" ADD CONSTRAINT "series_genres_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_genres" ADD CONSTRAINT "series_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unlocked_episodes" ADD CONSTRAINT "user_unlocked_episodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unlocked_episodes" ADD CONSTRAINT "user_unlocked_episodes_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_series" ADD CONSTRAINT "saved_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_series" ADD CONSTRAINT "saved_series_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_wallets" ADD CONSTRAINT "coin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_coin_pack_id_fkey" FOREIGN KEY ("coin_pack_id") REFERENCES "coin_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
