create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table users (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  email          text not null,
  name           text not null,
  role           text not null default 'staff'
                 check (role in ('owner', 'admin', 'staff', 'customer')),
  password_hash  text,
  created_at     timestamptz not null default now(),
  unique (tenant_id, email)
);

create table bookings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  customer_name   text not null,
  customer_email  text not null,
  service         text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'completed', 'cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index bookings_tenant_starts_idx on bookings (tenant_id, starts_at);

create table idempotency_keys (
  tenant_id        uuid not null references tenants(id) on delete cascade,
  key              text not null,
  request_hash     text not null,
  response_status  integer,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  primary key (tenant_id, key)
);