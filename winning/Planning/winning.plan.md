<!-- c370ebc1-b907-4779-b761-bebb8c13c094 a2254dad-4dd7-4eb5-922b-801e64995c5d -->
# Circle Planner MVP (manual entry, shared within Circle)

## Scope

- Everyone in a Circle shares all planner content with that Circle (private outside).
- Views: personal, member, and combined (aggregate) views.
- Manual entry pages mirroring your paper planner.

## Key Pages/Features

- Auth & Circles
- Email sign-in (magic link) or OAuth; create/join Circle via invite link.
- Member directory per Circle; switch active Circle.
- Long‑term Goal pages (x5 per user)
- Fields: goal, why, deadline, action plan, milestones (ordered), strategy notes.
- Link milestones to weeks; tasks auto-suggested in weekly/daily.
- Habit Tracker (10 habits per month)
- 10 named habits; month grid (1–31) with checkboxes; streaks + completion %.
- Routines
- Morning and evening routine lists with optional durations and checkboxes.
- Month View
- Standard calendar grid; events/tasks by date; quick-add; filter by member.
- Weekly Review + Plan
- Review: achievements, lessons, reflections; upcoming focus and top 3 outcomes.
- Plan: schedule priorities, tasks linked to goals/milestones.
- Daily Page
- Daily priority, schedule blocks, to‑dos (linked/unlinked), notes; mark done → win.
- Wins & Social
- Completing linked tasks creates a Win; feed in Circle; comments and reactions.
- Combined View
- Month/Week/Daily aggregate filters: mine, Mark, Jed, or combined.
- Conflict/high-load highlights; unlinked-task warnings.

## Data Model (conceptual)

- User(id, profile)
- Circle(id, name); CircleMember(userId, role)
- Goal(id, userId, circleId, horizon, fields…)
- Milestone(id, goalId, dueWeek)
- Habit(id, userId, name, month)
- HabitCheck(id, habitId, date, value)
- Routine(id, userId, type[morning|evening], steps[])
- EventTask(id, userId, circleId, date/time, type[event|task], linkedGoalId?, linkedMilestoneId?, status)
- Review(id, userId, week, achievements, lessons, reflections, nextFocus)
- Win(id, userId, eventTaskId?, goalId?)
- Comment(id, circleId, targetType, targetId, text)

## Tech (sensible defaults)

- Next.js app router, TypeScript, Tailwind CSS.
- Supabase (Postgres, Auth, RLS) for auth, data, realtime feed.
- Date handling with date-fns; calendar UI library or custom.

## Navigation & Routes (Next.js)

- `/login`, `/circles` (create/join), `/c/[circleId]` (dashboard)
- Within circle:
- `/c/[circleId]/me` (my planner)
- `/c/[circleId]/member/[userId]` (member planner)
- `/c/[circleId]/combined` (aggregate views with filters)
- Subroutes or tabs: goals, habits, routines, month, week, day, feed

## UI Components (high-level)

- GoalEditor, MilestoneList, HabitGrid, RoutineList, CalendarMonth, WeekPlanner, DayPlanner, WinBadge, FeedList, MemberFilter, CombinedToggle.

## Privacy & Sharing

- All content is visible to members of the active Circle; private to others.
- Per-item visibility may come later if needed.

## MVP Success Criteria

- Create a Circle, add members, each member can:
- Enter goals (x5), habits (10), routines, month/weekly/daily data.
- Mark tasks done and see wins.
- View Mark/Jed planners and a combined plan.
- Comment on wins or items in feed.

## Nice-to-haves (post-MVP)

- Notifications/digests, streaks/momentum score, templates, calendar sync.

## Implementation Notes

- Enforce referential links (tasks → milestone → goal). Validate at save.
- Combined views: server queries with member filter array; color-code by member.
- Performance: paginate feed; lazy-load month/weekly grids.

### To-dos

- [ ] Implement auth and Circle creation/join flows 
(Completed Oct 17, 11:00am)
- [ ] Set up database schema for goals, habits, routines, tasks, wins, comments
- [ ] Build Circle dashboard with member switcher and combined toggle
- [ ] Create Long-term Goal page with milestones and strategy notes
- [ ] Build 10-habit monthly tracker with streaks and %
- [ ] Build morning/evening routine editors with steps
- [ ] Implement month calendar with events/tasks and member filters
- [ ] Create weekly review and upcoming plan with top outcomes
- [ ] Create daily page: priority, schedule, to-dos, notes
- [ ] Auto-create wins on task completion; feed with comments/reactions
- [ ] Aggregate month/week/day across selected members