# FleetLog

A fleet transport management web application built with Next.js 16, TypeScript, Tailwind CSS, Prisma, and NextAuth v5.

## Features

- **Role-based access control**: DRIVER, CONTRACTOR, MANAGER roles
- **Transport tracking**: Record container transports with from/to places, container size (20/40/45 ft), IMO/ADR flag, waiting time, price, driver, contractor, and seller
- **Price visibility**: Drivers cannot see prices; contractors and managers can
- **Authentication**: Credentials-based login with bcrypt password hashing

## Getting Started

Copy `.env.local.example` to `.env.local` and set your `NEXTAUTH_SECRET`:

```bash
cp .env.local.example .env.local
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
