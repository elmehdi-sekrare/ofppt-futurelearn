# OFPPT FutureLearn

OFPPT FutureLearn is a role-based attendance and justification management web application for educational use.

## Features

- Role-based access (Admin, Teacher, Student)
- Authentication and protected routes
- Student, teacher, and group management
- Absence tracking and history
- Justification submission and review flow
- Dashboard views and reporting sections

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Installation

```bash
git clone <your-repository-url>
cd ofppt-futurelearn
npm install
```

### Run in Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Run Tests

```bash
npm run test
```

## Backend

This frontend is designed to work with a Laravel API backend.

- Setup guide: `docs/laravel-backend-guide.md`
- API base URL used in development: `http://127.0.0.1:8000/api`

## Project Structure (high level)

- `src/pages` — route-level pages
- `src/components` — reusable UI components
- `src/stores` — application state stores
- `src/services` — API integration layer
- `src/types` — shared TypeScript types
- `database` — SQL schema/seed references
