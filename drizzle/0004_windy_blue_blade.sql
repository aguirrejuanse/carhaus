CREATE TABLE "pricing_preview_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pricing_preview_requests_ip_idx" ON "pricing_preview_requests" USING btree ("ip");