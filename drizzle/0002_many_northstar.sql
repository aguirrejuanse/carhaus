ALTER TABLE "verification_codes" ADD COLUMN "request_ip" text;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_email_unique" UNIQUE("email");