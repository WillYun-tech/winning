# Implement Planner Features (Goals, Habits, Routines, Tasks, Wins)

## Assumptions
- Database schema already created (goals, milestones, habits, habit_checks, routines, tasks, reviews, wins, comments)
- RLS policies in place for personal data (circle_id IS NULL) and circle-based viewing
- Circle authentication and membership guards working
- Next.js App Router with TypeScript

## Data Model: Personal Planner + Circle Visibility
- **Personal Planner**: Each user has ONE personal planner with their own goals, habits, routines, etc.
- **Circle Visibility**: All circle members can VIEW each other's personal planners
- **Data Storage**: Personal data stored with `circle_id = NULL`, visible to all circles user belongs to
- **Management**: Users manage their personal planner in `/planner/*` routes
- **Viewing**: Circle members view everyone's data in `/c/[circleId]/*` routes

## Database Schema (Updated)
- `goals(id, user_id, circle_id=NULL, title, description, horizon, deadline, why, action_plan, strategy_notes)`
- `milestones(id, goal_id, title, description, due_week, completed, completed_at)`
- `habits(id, user_id, circle_id=NULL, name, month_year)`
- `habit_checks(id, habit_id, date, completed)`
- `routines(id, user_id, circle_id=NULL, type, steps)`
- `tasks(id, user_id, circle_id=NULL, title, description, type, date, time, priority, status, linked_goal_id, linked_milestone_id)`
- `reviews(id, user_id, circle_id=NULL, week_start, achievements, lessons, reflections, next_focus, top_outcomes)`
- `wins(id, user_id, circle_id=NULL, title, description, task_id, goal_id)`
- `comments(id, user_id, circle_id=NULL, target_type, target_id, text)`

## App Routes & Navigation

### Personal Planner Routes (Management)
- `/planner` - Personal planner dashboard (redirects to goals)
- `/planner/goals` - Personal goals management (5 slots) with milestones
- `/planner/habits` - Personal habit tracker (10 habits × month grid)
- `/planner/routines` - Personal morning/evening routine editor
- `/planner/month` - Personal monthly calendar view
- `/planner/week` - Personal weekly review and planning
- `/planner/day` - Personal daily planning page
- `/planner/wins` - Personal wins feed

### Circle View Routes (Read-Only Viewing)
- `/c/[circleId]` - Circle dashboard with tab navigation
- `/c/[circleId]?tab=goals` - View all circle members' goals
- `/c/[circleId]?tab=habits` - View all circle members' habits
- `/c/[circleId]?tab=routines` - View all circle members' routines
- `/c/[circleId]?tab=month` - View all circle members' monthly calendars
- `/c/[circleId]?tab=week` - View all circle members' weekly plans
- `/c/[circleId]?tab=day` - View all circle members' daily plans
- `/c/[circleId]?tab=wins` - View all circle members' wins feed

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

### Personal Planner Pages (Management)

#### 1. Personal Planner Dashboard (`/planner`)
- Redirects to `/planner/goals`
- Navigation to all personal planner sections

#### 2. Personal Goals Page (`/planner/goals`)
- 5 goal slots (long-term, medium-term, short-term)
- Each goal: title, why, deadline, action plan, strategy notes
- Milestones linked to goals with due weeks
- Progress tracking and completion status
- User filter dropdown (view own goals or other circle members' goals)
- Read-only access for others' goals

#### 3. Personal Habits Page (`/planner/habits`)
- 10 named habits per month
- Month grid (1-31) with checkboxes
- Streak counters and completion percentages
- Month selector to view different months
- Habit creation/editing interface

#### 4. Personal Routines Page (`/planner/routines`)
- Morning routine editor (steps with optional durations)
- Evening routine editor (steps with optional durations)
- Daily completion tracking
- Routine templates and customization

#### 5. Personal Month View (`/planner/month`)
- Standard calendar grid (Sunday-Saturday)
- Personal events and tasks by date
- Quick-add functionality

#### 6. Personal Week View (`/planner/week`)
- **Review Section**: achievements, lessons learned, reflections
- **Planning Section**: upcoming focus, top 3 outcomes
- **Schedule**: priorities and tasks linked to goals/milestones
- Week selector and navigation

#### 7. Personal Day View (`/planner/day`)
- Daily priority at top
- Schedule blocks with time slots
- To-do list (linked/unlinked to goals)
- Notes section
- Mark tasks done → auto-create wins

#### 8. Personal Wins Feed (`/planner/wins`)
- Personal wins feed
- Win creation from completed tasks

### Circle View Pages (Read-Only)

#### 9. Circle Dashboard (`/c/[circleId]`)
- Tab navigation to all circle views
- Quick stats across all members
- Member list with recent activity

#### 10. Circle Goals View (`/c/[circleId]?tab=goals`)
- View all circle members' goals combined
- Read-only access to everyone's goals
- Member filter dropdown
- Link to personal goals management

#### 11. Circle Habits View (`/c/[circleId]?tab=habits`)
- View all circle members' habit grids
- Combined view of everyone's habits
- Member filter dropdown
- Link to personal habits management

#### 12. Circle Routines View (`/c/[circleId]?tab=routines`)
- View all circle members' routines
- Combined morning/evening routine display
- Member filter dropdown
- Link to personal routines management

#### 13. Circle Month View (`/c/[circleId]?tab=month`)
- Combined calendar view of all members
- Color coding by member
- Member filter (show all, specific members)
- Link to personal month management

#### 14. Circle Week View (`/c/[circleId]?tab=week`)
- Combined weekly plans from all members
- Member filter dropdown
- Link to personal week management

#### 15. Circle Day View (`/c/[circleId]?tab=day`)
- Combined daily plans from all members
- Member filter dropdown
- Link to personal day management

#### 16. Circle Wins Feed (`/c/[circleId]?tab=wins`)
- Combined wins feed from all circle members
- Comments and reactions on wins
- Filter by member or goal
- Link to personal wins management

## Data Flow & Relationships
- **Goals** → **Milestones** → **Tasks** (hierarchical linking)
- **Tasks** completion → **Wins** (automatic creation)
- **Habits** → **Habit Checks** (daily tracking)
- **Wins** → **Comments** (social interaction)
- **Personal Data**: All content stored with `circle_id = NULL` (personal to user)
- **Circle Visibility**: Personal data visible to all circles user belongs to via RLS policies

## Implementation Steps

### Phase 1: Personal Planner Core (Week 1)
1. **Personal Goals Page** - Goal creation, editing, milestone management
2. **Personal Habits Page** - Monthly habit tracking with grid
3. **Personal Planner Navigation** - Links between personal pages

### Phase 2: Personal Planner Features (Week 2)
4. **Personal Routines Page** - Morning/evening routine management
5. **Personal Day Page** - Daily planning and task management
6. **Personal Month View** - Calendar with events and tasks

### Phase 3: Personal Planning & Wins (Week 3)
7. **Personal Week View** - Weekly review and planning
8. **Personal Wins Feed** - Achievement tracking
9. **Personal Planner Dashboard** - Navigation hub

### Phase 4: Circle Views (Week 4)
10. **Circle Dashboard** - Tab navigation and member stats
11. **Circle Goals View** - Combined goals from all members
12. **Circle Habits View** - Combined habits from all members
13. **Circle Routines View** - Combined routines from all members
14. **Circle Month/Week/Day Views** - Combined planning views
15. **Circle Wins Feed** - Combined wins with comments and reactions

## File/Folder Structure
```
app/
├── planner/                          # Personal Planner (Management)
│   ├── page.tsx                     # Redirects to goals
│   ├── layout.tsx                   # Personal planner layout
│   ├── goals/
│   │   └── page.tsx                 # Personal goals management
│   ├── habits/
│   │   └── page.tsx                 # Personal habits management
│   ├── routines/
│   │   └── page.tsx                 # Personal routines management
│   ├── month/
│   │   └── page.tsx                 # Personal monthly calendar
│   ├── week/
│   │   └── page.tsx                 # Personal weekly planning
│   ├── day/
│   │   └── page.tsx                 # Personal daily planning
│   └── wins/
│       └── page.tsx                 # Personal wins feed
├── c/[circleId]/                    # Circle Views (Read-Only)
│   ├── page.tsx                     # Circle dashboard with tabs
│   └── (tab content handled via query params)
└── components/
    ├── GoalEditor.tsx
    ├── MilestoneList.tsx
    ├── HabitGrid.tsx
    ├── RoutineEditor.tsx
    ├── CalendarMonth.tsx
    ├── WeekPlanner.tsx
    ├── DayPlanner.tsx
    ├── WinCard.tsx
    ├── MemberFilter.tsx
    └── CircleTabNavigation.tsx
```

## API Routes Needed
- `POST /api/planner/goals` - Create personal goal
- `PUT /api/planner/goals/[id]` - Update personal goal
- `POST /api/planner/milestones` - Create milestone
- `POST /api/planner/habits` - Create personal habit
- `POST /api/planner/habit-checks` - Toggle habit check
- `POST /api/planner/tasks` - Create personal task
- `PUT /api/planner/tasks/[id]` - Update task status
- `POST /api/planner/wins` - Create personal win
- `POST /api/planner/comments` - Add comment
- `GET /api/c/[circleId]/goals` - Get all circle members' goals
- `GET /api/c/[circleId]/habits` - Get all circle members' habits
- `GET /api/c/[circleId]/routines` - Get all circle members' routines
- `GET /api/c/[circleId]/wins` - Get all circle members' wins

## Testing Checklist
- [ ] Create personal goal with milestones
- [ ] Track personal habits for a month
- [ ] Set up personal morning/evening routines
- [ ] Create and complete personal tasks
- [ ] Generate wins from completed tasks
- [ ] View other circle members' data in circle views
- [ ] Use circle combined views
- [ ] Comment on wins in circle views
- [ ] Navigation between personal planner pages
- [ ] Navigation between circle views

## Success Criteria
- Users can create and manage all personal planner content
- Personal data is properly visible to all circles user belongs to
- Tasks link to goals and milestones
- Wins are automatically created from task completion
- Circle views work across multiple members
- All pages are responsive and intuitive
- Clear separation between personal management and circle viewing

## Next Immediate Steps
1. **Build Personal Routines Page** (`/planner/routines/page.tsx`) with morning/evening routine editor
2. **Add Personal Planner Navigation** - Links between personal pages
3. **Test routine creation and management**
4. **Begin Circle Views** - Start with circle goals view

### To-dos

- [x] Create Personal Goals Page with 5 goal slots and milestone management
- [x] Create Personal Habit Tracker with 10 habits × month grid
- [x] Build Personal Routines Page for morning/evening routines
(completed Oct 20, 5:15am)
- [x] Implement Personal Month Calendar with events and tasks
(completed Oct 20, 6:20am)
- [x] Create Personal Week Review and Planning page
(Completed Oct 20, 6:56am) 
- [ ] Build Personal Daily Planning page with priorities and to-dos
- [ ] Implement Personal Wins Feed
- [ ] Create Circle Dashboard with tab navigation
- [ ] Build Circle Goals View (combined from all members)
- [ ] Build Circle Habits View (combined from all members)
- [ ] Build Circle Routines View (combined from all members)
- [ ] Build Circle Month/Week/Day Views (combined from all members)
- [ ] Build Circle Wins Feed with comments and reactions
- [ ] Add Member Filtering for all circle views
- [ ] Add API routes for all CRUD operations
- [ ] Implement task-to-goal/milestone linking
- [ ] Add automatic win creation from task completion



# Things that need to get fixed: 
Don't like how you can't click on the months day to see all the events. 

Don't want our weekly tasks to show up as events in our month page or on our daily page as a todo list. Should be seperate. Want schedule to have blocks of 30mins from 5am to 10am and be verticle. 

