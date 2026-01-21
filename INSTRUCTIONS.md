# VMS Studio - Agent Instructions

> Instructions for AI agents working on this codebase

## Project Overview

This is **Family Days Reminder** (Based on VMS Computer Check scaffold) - a production-ready Next.js 15 + Firebase application.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, ShadCN/Radix UI, Recharts
- **Forms**: React Hook Form + Zod validation
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **AI**: Genkit with Google AI
- **Hosting**: Firebase App Hosting

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin-only routes
│   ├── dashboard/          # User dashboard
│   ├── login/, register/   # Auth pages
│   └── profile/            # User settings
├── components/
│   ├── ui/                 # ShadCN components (30+)
│   ├── layout/             # Headers, layouts
├── firebase/               # Firebase SDK & hooks
│   ├── config.ts           # Firebase config
│   ├── firestore/          # Real-time hooks
│   └── provider.tsx        # Auth context
├── hooks/                  # Custom React hooks
├── lib/                    # Types, utils, config
└── ai/                     # Genkit AI setup

functions/                  # Cloud Functions (TypeScript)
```

## User Roles

1. **Regular User**: Standard access
2. **Admin**: Full access

## Development Commands

```bash
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run genkit:dev    # Start Genkit AI dev server
npm run typecheck     # TypeScript check
```

## Firebase Project

- Config: `src/firebase/config.ts`
- Rules: `firestore.rules`, `storage.rules`

## Operating Principles

1. **Check existing code first** - This is a mature codebase. Look for existing patterns before adding new ones.

2. **Preserve the architecture** - Follow the existing component/hook patterns. Don't introduce new state management.

3. **Firebase-first** - Use Firestore real-time listeners. Don't add REST APIs unless necessary.

4. **Type safety** - All types are in `src/lib/types.ts`. Use them.

5. **UI consistency** - Use existing ShadCN components from `src/components/ui/`.

## Common Tasks

**Adding a new page:**
1. Create folder in `src/app/[route]/`
2. Add `page.tsx` with appropriate auth guards
3. Use `AuthenticatedLayout` wrapper

**Adding a component:**
1. Check if similar exists in `src/components/`
2. Use ShadCN primitives from `src/components/ui/`
3. Follow existing naming patterns

**Modifying Firestore:**
1. Update types in `src/lib/types.ts`
2. Update security rules in `firestore.rules`
3. Test with Firebase emulators if available

## Environment Variables

See `.env` for required variables:
- `GOOGLE_GENAI_API_KEY` - For Genkit AI features
- Firebase config is hardcoded in `src/firebase/config.ts`
