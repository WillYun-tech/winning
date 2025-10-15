<!-- c370ebc1-b907-4779-b761-bebb8c13c094 fb9e8019-331c-464f-8495-bef8ea71687c -->
# Implement Authentication and Circle Creation/Join Flows

## Assumptions
- Use Supabase (Auth + Postgres + RLS). Project already/de-facto selected in MVP plan.
- Next.js App Router, TypeScript, server components with client wrappers where needed.
- All planner data is scoped by `circle_id`; membership in a Circle grants read access.

## Database Schema (Supabase)
- Tables
  - `circles(id uuid pk, name text not null, created_by uuid ref auth.users, created_at timestamptz)`
  - `circle_members(circle_id uuid ref circles on delete cascade, user_id uuid ref auth.users, role text check in ('owner','admin','member') default 'member', joined_at timestamptz, primary key(circle_id,user_id))`
  - `circle_invites(id uuid pk default gen_random_uuid(), circle_id uuid ref circles on delete cascade, inviter_id uuid ref auth.users, email text, role text default 'member', token text unique, expires_at timestamptz, accepted_by uuid, created_at timestamptz)`
- Policies (RLS)
  - `circles`: select where user is in `circle_members`; insert by authenticated; update/delete by owner/admin.
  - `circle_members`: select where user is member; insert: user == auth.uid() for self-join via invite; update role by owner/admin; delete self or by owner/admin.
  - `circle_invites`: select where inviter is member; insert by members; delete by inviter/admin; accept via RPC.
- RPC (optional but recommended)
  - `accept_invite(p_token text)` transactional: verify token+expiry → insert into `circle_members` for `auth.uid()` → mark invite accepted.

## Auth Flows
- Sign in options: Magic link (email) and Google OAuth.
- Post-auth onboarding: if user has no memberships, offer create Circle or paste invite.
- Session persistence with Supabase auth helpers.

## App Routes & Guards
- `app/(auth)/login/page.tsx`: Email/Google sign-in UI.
- `app/circles/page.tsx`: List circles user belongs to; create form; input for invite token.
- `app/c/[circleId]/layout.tsx`: Server guard loads session and membership; redirects to `/login` or `/circles` if unauthorized.
- `app/api/circles/route.ts` (POST): create circle + add current user as owner.
- `app/api/circles/[id]/invite/route.ts` (POST): create invite token.
- `app/api/invites/accept/route.ts` (POST): accept token (calls RPC).

## UI Components
- `components/AuthForm.tsx`: email magic link + Google button.
- `components/CircleCreateForm.tsx`: name → create.
- `components/InviteCreate.tsx`: generate invite link with role + expiry; copy-to-clipboard.
- `components/InviteAccept.tsx`: paste token, show circle preview, accept.
- `components/CircleList.tsx`: list memberships with roles; navigate to circle dashboard.

## Invite Link Format
- `https://app.host/invite?token=<opaque>` stored in `circle_invites.token`.
- Token is random 32–40 char string; expires in 7 days by default.

## Edge Cases & Rules
- A user can be in multiple circles; switch via `/circles`.
- Owner can transfer ownership and delete Circle (soft-delete later).
- Reuse of invite after accepted: deny; allow multiple accepts only if invite email is null and flagged as `multi_use`.
- Prevent joining if already a member.

## Implementation Steps
1. Install Supabase client and auth helpers; configure env vars.
2. Create DB tables and policies; add `accept_invite` RPC.
3. Build `/login` with AuthForm; handle magic link and OAuth; redirect to `/circles`.
4. Build `/circles` with CircleList and CircleCreateForm.
5. Implement POST `/api/circles` to create circle + owner membership.
6. Build invite management on circle dashboard sidebar (MVP can place on `/circles`).
7. Implement POST `/api/circles/[id]/invite` to create invites; show copyable link.
8. Implement `/invite` page to accept token; call `/api/invites/accept` (or RPC direct) and redirect to `/c/[circleId]`.
9. Add server guard in `app/c/[circleId]/layout.tsx` to verify membership.
10. Add topbar circle switcher usable across circle routes.
11. Basic styling, empty states, and error toasts.

## File/Folder Plan
- `lib/supabase/server.ts` and `lib/supabase/client.ts`
- `lib/auth.ts` (helpers for getSession, requireUser)
- `app/(auth)/login/page.tsx`
- `app/circles/page.tsx`
- `app/c/[circleId]/layout.tsx`
- `app/invite/page.tsx` (accept UI via query param)
- `app/api/circles/route.ts`
- `app/api/circles/[id]/invite/route.ts`
- `app/api/invites/accept/route.ts`
- `components/*` as listed above
- `sql/` directory with schema, policies, and RPC script

## Testing Checklist
- Sign up/in/out, session restore on refresh.
- Create circle; user added as owner.
- Generate invite; second account accepts → becomes member.
- Unauthorized access to `/c/[id]` redirects.
- Policies block cross-circle access.

## Rollout
- Feature flag behind environment var for invites if needed.
- Seed a dev Circle and two test users.

## Acceptance Criteria
- Any circle member can view all circle content.
- Invite flow works end-to-end with expiry and single-use default.
- Guards prevent non-members from accessing circle routes.


### To-dos

- [ ] Install Supabase, configure env, add server/client helpers (Completed: Oct 14, 8:00am)
- [ ] Create circles, circle_members, circle_invites tables with RLS and RPC
(completed: Oct 15, 5:14am)
- [ ] Build email magic link + Google OAuth login page
(Completed: Oct 15: 8:00am)
- [ ] List user circles, create circle form, invite entry
- [ ] Create API route to create circle and owner membership
- [ ] Create invite generation endpoint and UI with expiry and role
- [ ] Add /invite page and accept endpoint to join circle
- [ ] Add membership guard to /c/[circleId] routes
- [ ] Add topbar circle switcher for multi-circle users