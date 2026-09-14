CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."snack_choice" AS ENUM('none', 'sweet', 'salty', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round_trip');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"plate" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cars_plate_unique" UNIQUE("plate")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"recipient" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_fare_cents" integer NOT NULL,
	"per_km_cents" integer NOT NULL,
	"per_minute_cents" integer NOT NULL,
	"minimum_fare_cents" integer NOT NULL,
	"night_multiplier_basis_points" integer DEFAULT 10000 NOT NULL,
	"night_start_hour" smallint DEFAULT 22 NOT NULL,
	"night_end_hour" smallint DEFAULT 6 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"snack_choice" "snack_choice" DEFAULT 'none' NOT NULL,
	"spotify_playlist_url" text,
	"ac_temperature_celsius" integer,
	CONSTRAINT "trip_extras_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "trip_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"sequence" smallint NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "trip_legs_trip_sequence_unique" UNIQUE("trip_id","sequence"),
	CONSTRAINT "trip_legs_sequence_check" CHECK ("trip_legs"."sequence" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "trip_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_email" text NOT NULL,
	"name" text NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"legs" jsonb NOT NULL,
	"snack_choice" "snack_choice" DEFAULT 'none' NOT NULL,
	"spotify_playlist_url" text,
	"ac_temperature_celsius" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "trip_status" DEFAULT 'pending' NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"public_token" text NOT NULL,
	"assigned_car_id" uuid,
	"assigned_driver_id" uuid,
	"total_price_cents" integer NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "trips_approved_requires_assignment" CHECK (("trips"."status" <> 'approved') OR ("trips"."assigned_car_id" IS NOT NULL AND "trips"."assigned_driver_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_extras" ADD CONSTRAINT "trip_extras_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_legs" ADD CONSTRAINT "trip_legs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_assigned_car_id_cars_id_fk" FOREIGN KEY ("assigned_car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_assigned_driver_id_drivers_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;