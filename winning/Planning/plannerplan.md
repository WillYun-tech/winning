# Implement Planner Features (Goals, Habits, Routines, Tasks, Wins)

## Assumptions
- Database schema already created (goals, milestones, habits, habit_checks, routines, tasks, reviews, wins, comments)
- RLS policies in place for circle-based access
- Circle authentication and membership guards working
- Next.js App Router with TypeScript

## Database Schema (Already Created)
- `goals(id, user_id, circle_id, title, description, horizon, deadline, why, action_plan, strategy_notes)`
- `milestones(id, goal_id, title, description, due_week, completed, completed_at)`
- `habits(id, user_id, circle_id, name, month_year)`
- `habit_checks(id, habit_id, date, completed)`
- `routines(id, user_id, circle_id, type, steps)`
- `tasks(id, user_id, circle_id, title, description, type, date, time, priority, status, linked_goal_id, linked_milestone_id)`
- `reviews(id, user_id, circle_id, week_start, achievements, lessons, reflections, next_focus, top_outcomes)`
- `wins(id, user_id, circle_id, title, description, task_id, goal_id)`
- `comments(id, user_id, circle_id, target_type, target_id, text)`

## App Routes & Navigation
- `/c/[circleId]` - Circle dashboard with navigation
- `/c/[circleId]/goals` - Long-term goals (5 slots) with milestones
- `/c/[circleId]/habits` - 10-habit monthly tracker
- `/c/[circleId]/routines` - Morning/evening routine editor
- `/c/[circleId]/month` - Monthly calendar view
- `/c/[circleId]/week` - Weekly review and planning
- `/c/[circleId]/day` - Daily planning page
- `/c/[circleId]/wins` - Wins feed with comments
- `/c/[circleId]/combined` - Aggregate views across members

## UI Components Needed
- `GoalEditor` - Create/edit goals with all fields
- `MilestoneList` - Manage milestones for a goal
- `HabitGrid` - 10 habits × month grid with checkboxes
- `RoutineEditor` - Morning/evening routine with steps
- `CalendarMonth` - Monthly calendar with events/tasks
- `WeekPlanner` - Weekly review form + upcoming planning
- `DayPlanner` - Daily priority, schedule, to-dos, notes
- `WinCard` - Display wins with comments/reactions
- `MemberFilter` - Filter views by circle members
- `CombinedToggle` - Switch between personal/combined views

## Key Features by Page

### 1. Circle Dashboard (`/c/[circleId]`)
- Navigation menu to all planner sections
- Quick stats (goals progress, habit streaks, recent wins)
- Member list with recent activity
- Combined view toggle

### 2. Goals Page (`/c/[circleId]/goals`)
- 5 goal slots (long-term, medium-term, short-term)
- Each goal: title, why, deadline, action plan, strategy notes
- Milestones linked to goals with due weeks
- Progress tracking and completion status
- Link to weekly/daily task suggestions

### 3. Habits Page (`/c/[circleId]/habits`)
- 10 named habits per month
- Month grid (1-31) with checkboxes
- Streak counters and completion percentages
- Month selector to view different months
- Habit creation/editing interface

### 4. Routines Page (`/c/[circleId]/routines`)
- Morning routine editor (steps with optional durations)
- Evening routine editor (steps with optional durations)
- Daily completion tracking
- Routine templates and customization

### 5. Month View (`/c/[circleId]/month`)
- Standard calendar grid (Sunday-Saturday)
- Events and tasks by date
- Quick-add functionality
- Member filter (show all, specific members, combined)
- Color coding by member

### 6. Week View (`/c/[circleId]/week`)
- **Review Section**: achievements, lessons learned, reflections
- **Planning Section**: upcoming focus, top 3 outcomes
- **Schedule**: priorities and tasks linked to goals/milestones
- Week selector and navigation

### 7. Day View (`/c/[circleId]/day`)
- Daily priority at top
- Schedule blocks with time slots
- To-do list (linked/unlinked to goals)
- Notes section
- Mark tasks done → auto-create wins

### 8. Wins Feed (`/c/[circleId]/wins`)
- Chronological feed of all circle wins
- Comments and reactions on wins
- Filter by member or goal
- Win creation from completed tasks

### 9. Combined View (`/c/[circleId]/combined`)
- Aggregate month/week/day across selected members
- Conflict detection (overlapping events)
- High-load warnings
- Unlinked task warnings
- Member comparison views

## Data Flow & Relationships
- **Goals** → **Milestones** → **Tasks** (hierarchical linking)
- **Tasks** completion → **Wins** (automatic creation)
- **Habits** → **Habit Checks** (daily tracking)
- **Wins** → **Comments** (social interaction)
- All content scoped by **circle_id** for sharing

## Implementation Steps

### Phase 1: Core Pages (Week 1)
1. **Circle Dashboard** - Navigation and quick stats
2. **Goals Page** - Goal creation, editing, milestone management
3. **Basic Navigation** - Links between pages

### Phase 2: Tracking Features (Week 2)
4. **Habits Page** - Monthly habit tracking with grid
5. **Routines Page** - Morning/evening routine management
6. **Day Page** - Daily planning and task management

### Phase 3: Calendar & Planning (Week 3)
7. **Month View** - Calendar with events and tasks
8. **Week View** - Weekly review and planning
9. **Wins Feed** - Achievement tracking and social features

### Phase 4: Advanced Features (Week 4)
10. **Combined Views** - Aggregate across members
11. **Member Filtering** - Show specific members' data
12. **Advanced Linking** - Tasks to goals/milestones

## File/Folder Structure
```
app/c/[circleId]/
├── page.tsx (dashboard)
├── goals/
│   ├── page.tsx
│   └── [goalId]/
│       └── page.tsx (goal editor)
├── habits/
│   └── page.tsx
├── routines/
│   └── page.tsx
├── month/
│   └── page.tsx
├── week/
│   └── page.tsx
├── day/
│   └── page.tsx
├── wins/
│   └── page.tsx
└── combined/
    └── page.tsx

components/
├── GoalEditor.tsx
├── MilestoneList.tsx
├── HabitGrid.tsx
├── RoutineEditor.tsx
├── CalendarMonth.tsx
├── WeekPlanner.tsx
├── DayPlanner.tsx
├── WinCard.tsx
├── MemberFilter.tsx
└── CombinedToggle.tsx
```

## API Routes Needed
- `POST /api/c/[circleId]/goals` - Create goal
- `PUT /api/c/[circleId]/goals/[id]` - Update goal
- `POST /api/c/[circleId]/milestones` - Create milestone
- `POST /api/c/[circleId]/habits` - Create habit
- `POST /api/c/[circleId]/habit-checks` - Toggle habit check
- `POST /api/c/[circleId]/tasks` - Create task
- `PUT /api/c/[circleId]/tasks/[id]` - Update task status
- `POST /api/c/[circleId]/wins` - Create win
- `POST /api/c/[circleId]/comments` - Add comment

## Testing Checklist
- [ ] Create goal with milestones
- [ ] Track habits for a month
- [ ] Set up morning/evening routines
- [ ] Create and complete tasks
- [ ] Generate wins from completed tasks
- [ ] View other members' data
- [ ] Use combined views
- [ ] Comment on wins
- [ ] Navigation between all pages

## Success Criteria
- Users can create and manage all planner content
- Data is properly shared within circles
- Tasks link to goals and milestones
- Wins are automatically created from task completion
- Combined views work across multiple members
- All pages are responsive and intuitive

## Next Immediate Steps
1. **Create Circle Dashboard** (`/c/[circleId]/page.tsx`) with navigation
2. **Build Goals Page** (`/c/[circleId]/goals/page.tsx`) with goal editor
3. **Add basic navigation** between pages
4. **Test goal creation and milestone management**

### To-dos

- [ ] Create Circle Dashboard with navigation menu
- [ ] Build Goals Page with 5 goal slots and milestone management
- [ ] Create Habit Tracker with 10 habits × month grid
- [ ] Build Routines Page for morning/evening routines
- [ ] Implement Month Calendar with events and tasks
- [ ] Create Week Review and Planning page
- [ ] Build Daily Planning page with priorities and to-dos
- [ ] Implement Wins Feed with comments and reactions
- [ ] Add Combined Views across circle members
- [ ] Create Member Filtering for all views
- [ ] Add API routes for all CRUD operations
- [ ] Implement task-to-goal/milestone linking
- [ ] Add automatic win creation from task completion
