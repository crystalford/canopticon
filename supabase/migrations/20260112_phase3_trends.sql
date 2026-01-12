-- Create trends table for Pulse
create table "public"."trends" (
    "id" uuid not null default gen_random_uuid(),
    "topic" text not null,
    "volume" integer not null default 0,
    "domain" text,
    "sentiment" double precision,
    "timestamp" timestamp with time zone not null default now(),
    "signal_id" uuid,
    constraint "trends_pkey" primary key ("id")
);

-- Foreign key to signals if a trend promotes to a signal
alter table "public"."trends" add constraint "trends_signal_id_fkey" foreign key ("signal_id") references "public"."signals" ("id") on delete set null;

-- Enable RLS
alter table "public"."trends" enable row level security;

-- Policies (Admin read/write)
create policy "Enable read access for all users" on "public"."trends" for select using (true);
create policy "Enable insert for authenticated users only" on "public"."trends" for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on "public"."trends" for update to authenticated using (true);

-- Indexes for performance
create index "trends_topic_idx" on "public"."trends" using btree ("topic");
create index "trends_timestamp_idx" on "public"."trends" using btree ("timestamp");
