# FleetLog

A fleet transport management web application built with Next.js 16, TypeScript, Tailwind CSS, Prisma, and NextAuth v5.

## Features

- **Role-based access control**: ADMIN, DRIVER, CONTRACTOR, MANAGER roles
- **Transport tracking**: Record container transports with from/to places, container size (20/40/45 ft), IMO/ADR flag, waiting time, price, driver, contractor, and seller
- **Order numbers + freight letters**: Optional order number per container and PDF freight letter upload per transport
- **Recurring places**: Entered places are stored and can be selected again in transport forms
- **Multi-tenant workspaces**: Each manager has an isolated workspace (separate data environment)
- **Price visibility**: Drivers cannot see prices; contractors and managers can
- **Invoice control**: Only managers can create and send invoices; contractors receive sent invoices
- **Authentication**: Credentials-based login with bcrypt password hashing
- **Contractor onboarding**: Contractor registration requires company and tax details (company name, full address, VAT ID, tax number)

## Multi-Tenant Model

- Each `MANAGER` registration creates a dedicated workspace with a unique `workspace code`
- `DRIVER` and `CONTRACTOR` registrations must provide a valid workspace code to join the correct manager environment
- Transports, invoices, users, and place suggestions are scoped to workspace boundaries
- `ADMIN` has cross-workspace visibility via `/admin` and dashboard overview cards
- Admin account is read-only for operational transport actions

## Administrator Login

- Admin email is fixed to `info@karr-logistik.com`
- Set or change the admin password anytime with:

```bash
npm run admin:set-password -- "your-secure-password"
```

## Invoicing Workflow

- Log in as a user with role `MANAGER`
- Open `Invoices` and create an invoice for a contractor with open containers
- FleetLog creates one draft invoice containing all uninvoiced containers for that contractor
- Open the invoice and click **Send invoice**
- Sent invoices become visible to the contractor (received invoices)
- Invoiced transports are marked internally and are not included in the next invoice
- Invoice details intentionally do **not** show the driver name
- Open a sent invoice and click **Download PDF** (browser print flow) to save a PDF file
- Payment due date is always shown as **14 days from invoice send date**

## Invoice PDF Layout

- Header and footer are aligned to the reference invoice style (sender/recipient/meta/bank block)
- Position table includes date, order number, container, from/to, notes, net, VAT (19%), and gross amount
- Contractor registration data is printed on the invoice: company name, full address, country, VAT ID, and tax number

## Getting Started

Use Node.js `>=20.9.0` (recommended: `20.19.0`, see `.nvmrc`).

Copy `.env.local.example` to `.env.local` and set your `NEXTAUTH_SECRET`:

```bash
cp .env.local.example .env.local
```

If you use Prisma CLI directly, also copy values to `.env` (Prisma can read `.env.local`, but `.env` keeps tooling compatibility):

```bash
cp .env.local .env
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **TypeScript**
- **Tailwind CSS v4** — system font stack (no external font dependencies)
- **Prisma 6** with SQLite
- **NextAuth v5 beta** — JWT session strategy, credentials provider
- **bcryptjs** — password hashing

## Deployment

Set the following environment variables in production:

```
DATABASE_URL=file:./prisma/dev.db
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=https://your-domain.com
```
