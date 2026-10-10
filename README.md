# Multi-Tenant B2B SaaS Platform

A production-grade, multi-tenant B2B SaaS application built in 6 weeks. It serves many organizations from a single codebase with strict data isolation, subscription billing, real-time collaboration, and a full-stack UI.

## Features

- **Multi-tenant architecture:** Each organization's data is isolated at the database and application layers, so no tenant can access another's information.
- **Stripe billing:** Plan management, checkout, and webhook handling for payments, renewals, failed payments, and cancellations, synced with tenant access.
- **Real-time collaboration (CRDTs):** Multiple users can edit the same data at once; changes merge automatically without conflicts, even after being offline.
- **Redis:** Caching, session management, and pub/sub messaging for performance and scalability.
- **Full-stack UI:** Authentication, tenant dashboards, team management, and billing screens.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js / React |
| Backend | Node.js |
| Database | PostgreSQL (tenant-level isolation) |
| Real-time | CRDTs (Yjs), WebSockets |
| Cache / Pub-Sub | Redis |
| Payments | Stripe + Webhooks |

> Update this table to match your actual stack.

## Architecture Highlights

- Tenant isolation enforced on every request (tenant context + row-level security)
- Idempotent, signature-verified Stripe webhook handlers
- Redis pub/sub to fan out real-time updates across server instances
- CRDT-based document sync for conflict-free collaboration

## Getting Started

```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run migrate

# Start the development server
npm run dev
```

### Environment Variables

```
DATABASE_URL=
REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXTAUTH_SECRET=
```

## What I Learned

- Designing scalable, secure SaaS architecture
- Implementing tenant data isolation strategies
- Handling payment events reliably through webhooks
- Building real-time, conflict-free collaborative features
- Shipping an end-to-end product in an intensive 6-week timeline

## License

MIT