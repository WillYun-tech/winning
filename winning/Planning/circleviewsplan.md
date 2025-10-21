# Circle Views Implementation Plan

## Overview
Build comprehensive Circle Views that allow circle members to see and interact with each other's planner data in a social, collaborative way. This is the core social feature that enables mutual support and accountability.

## Current State
- ✅ Circle creation and membership system
- ✅ Personal planner with all features (goals, habits, routines, calendar, weekly, daily, wins)
- ✅ Basic circle page with tab navigation
- ❌ Circle views are placeholder content only

## Goals
1. **Social Accountability**: See what friends are working on
2. **Mutual Support**: Comment on and encourage each other's progress
3. **Inspiration**: Get ideas from others' goals and approaches
4. **Progress Tracking**: Monitor group progress on shared themes
5. **Celebration**: Share wins and milestones together

---

## Phase 1: Circle Goals View 🎯

### Features
- **Member Cards**: Each circle member gets their own section
- **Goal Display**: Show all personal goals with progress indicators
- **Milestone Tracking**: Visual progress on goal milestones
- **Filtering**: Filter by horizon (long/medium/short-term)
- **Sorting**: Sort by deadline, progress, or creation date

### Data Structure
```typescript
type CircleMember = {
  user_id: string;
  user_email: string;
  goals: Goal[];
  total_goals: number;
  completed_goals: number;
  active_milestones: number;
  completed_milestones: number;
}
```

### Implementation Steps
1. **Load Circle Members**: Query `circle_members` table
2. **Load Member Goals**: For each member, load their personal goals (`circle_id IS NULL`)
3. **Calculate Progress**: Count completed vs total goals and milestones
4. **Display Cards**: Show member info, goals, and progress
5. **Add Interactions**: Like/comment on goals (future enhancement)

---

## Phase 2: Circle Wins Feed 🏆

### Features
- **Combined Feed**: All circle members' wins in chronological order
- **Member Attribution**: Clear indication of who achieved each win
- **Win Categories**: Group by type (goals, habits, tasks, etc.)
- **Recent Activity**: Highlight wins from last 7 days
- **Celebration**: Emoji reactions and comments (future)

### Data Structure
```typescript
type CircleWin = {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  description: string;
  category: 'goals' | 'habits' | 'tasks' | 'general';
  created_at: string;
  goal_title?: string;
  milestone_title?: string;
}
```

### Implementation Steps
1. **Load All Wins**: Query wins from all circle members
2. **Join User Data**: Get user emails for attribution
3. **Categorize Wins**: Determine win category based on source
4. **Sort Chronologically**: Most recent wins first
5. **Display Feed**: Card-based layout with member info

---

## Phase 3: Circle Habits View 📈

### Features
- **Habit Grids**: Show all members' habit trackers side by side
- **Streak Leaderboard**: Who has the longest streaks
- **Monthly Progress**: Completion percentages for current month
- **Habit Themes**: Group similar habits across members
- **Motivation**: See others' consistency for inspiration

### Data Structure
```typescript
type CircleHabit = {
  user_id: string;
  user_email: string;
  habit_name: string;
  current_streak: number;
  monthly_completion: number;
  total_checks: number;
  last_check_date: string;
}
```

### Implementation Steps
1. **Load Member Habits**: Get all habits from circle members
2. **Calculate Stats**: Streaks, completion rates, recent activity
3. **Group by Habit**: Show same habits across members
4. **Display Grids**: Side-by-side habit trackers
5. **Add Leaderboard**: Top performers for each habit

---

## Phase 4: Circle Calendar View 📅

### Features
- **Combined Calendar**: All members' events in one view
- **Member Color Coding**: Different colors for each member
- **Event Types**: Distinguish between different event types
- **Privacy Controls**: Option to hide sensitive events
- **Scheduling**: See when others are busy/available

### Data Structure
```typescript
type CircleEvent = {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  date: string;
  type: 'event' | 'task' | 'priority';
  is_private: boolean;
}
```

### Implementation Steps
1. **Load Member Events**: Get all events from circle members
2. **Filter Private**: Respect privacy settings
3. **Color Code**: Assign colors to members
4. **Display Calendar**: Monthly view with member events
5. **Add Legend**: Show which color belongs to whom

---

## Phase 5: Circle Weekly View 📋

### Features
- **Weekly Plans**: See everyone's weekly focus areas
- **Task Sharing**: View others' weekly tasks
- **Progress Updates**: How everyone did on their weekly goals
- **Group Themes**: Common focus areas across members
- **Accountability**: Check in on weekly commitments

### Data Structure
```typescript
type CircleWeekly = {
  user_id: string;
  user_email: string;
  week_start: string;
  focus_areas: string[];
  top_outcomes: string[];
  tasks: Task[];
  wins: string[];
  lessons_learned: string;
}
```

### Implementation Steps
1. **Load Weekly Data**: Get weekly reviews from all members
2. **Group by Week**: Show current week's plans
3. **Display Cards**: Each member's weekly plan
4. **Show Progress**: Completed vs planned tasks
5. **Add Insights**: Common themes and patterns

---

## Phase 6: Enhanced Interactions 🤝

### Features
- **Comments**: Comment on goals, wins, and habits
- **Reactions**: Emoji reactions to show support
- **Encouragement**: Send motivational messages
- **Challenges**: Create group challenges
- **Notifications**: Alert when someone achieves something

### Data Structure
```typescript
type CircleComment = {
  id: string;
  user_id: string;
  user_email: string;
  target_type: 'goal' | 'win' | 'habit';
  target_id: string;
  content: string;
  created_at: string;
}

type CircleReaction = {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  emoji: string;
  created_at: string;
}
```

### Implementation Steps
1. **Create Comments Table**: Store comments on various items
2. **Create Reactions Table**: Store emoji reactions
3. **Add UI Components**: Comment and reaction interfaces
4. **Real-time Updates**: Show new comments/reactions
5. **Notification System**: Alert users of interactions

---

## Technical Implementation

### File Structure
```
app/c/[circleId]/
├── page.tsx (main circle page with tabs)
├── goals/
│   └── page.tsx (circle goals view)
├── wins/
│   └── page.tsx (circle wins feed)
├── habits/
│   └── page.tsx (circle habits view)
├── calendar/
│   └── page.tsx (circle calendar view)
└── weekly/
    └── page.tsx (circle weekly view)
```

### Database Considerations
- **RLS Policies**: Ensure circle members can only see each other's data
- **Performance**: Index on `user_id` and `circle_id` for fast queries
- **Privacy**: Add privacy controls for sensitive data
- **Caching**: Cache member data to reduce queries

### UI/UX Principles
- **Consistent Design**: Use planner design system throughout
- **Clear Attribution**: Always show who owns what data
- **Progressive Disclosure**: Show summary first, details on demand
- **Mobile Friendly**: Ensure all views work on mobile
- **Loading States**: Show loading indicators for data fetching

---

## Success Metrics
- **Engagement**: Time spent viewing circle data
- **Interactions**: Comments, reactions, and encouragement
- **Accountability**: Increased goal completion rates
- **Social Connection**: Members feel more connected
- **Motivation**: Users report feeling more motivated

---

## Future Enhancements
- **Group Challenges**: Create shared challenges
- **Progress Reports**: Weekly/monthly group summaries
- **Integration**: Connect with external tools
- **Analytics**: Track group progress over time
- **Gamification**: Points, badges, and leaderboards

---

## Implementation Timeline
- **Week 1**: Circle Goals View
- **Week 2**: Circle Wins Feed
- **Week 3**: Circle Habits View
- **Week 4**: Circle Calendar View
- **Week 5**: Circle Weekly View
- **Week 6**: Enhanced Interactions
- **Week 7**: Polish and Testing
- **Week 8**: Launch and Feedback

This plan provides a comprehensive roadmap for building the social aspects of the planner, enabling the mutual support and accountability that makes the app truly valuable for friend groups working on their goals together.
