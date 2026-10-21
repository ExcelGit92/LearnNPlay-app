# LearnNPlay Roadmap

## Project Overview

LearnNPlay is an interactive quiz & gamified training platform built with TanStack Start, React 19, Tailwind CSS, and Lovable Cloud (Supabase) backend.

---

## ✅ Completed Features (DO NOT rewrite or break these)

### 1. Trainer Workspace

- Authentication system
- Dashboard for trainers
- Quiz Library management
- Analytics dashboard

### 2. Quiz Creation

- Manual quiz creation
- AI-assisted quiz generation from uploaded PPTX/PDF files

### 3. Multilingual System

- Support for 16 languages
- Dual-language display
- RTL (Right-to-Left) support
- Participant language switcher

### 4. Live Hosting & Joining

- 6-digit PIN code join system
- QR code join system
- Players don't need accounts to join
- Live timer during sessions
- Server-side tamper-proof scoring

### 5. Competition Modes

- Individual mode
- Team mode
- Individual+Team combined mode
- Mode chosen at creation, carried into session

### 6. Teams & Gamification

- Up to 8 teams with accessible colors/icons/names
- Team leaderboards
- Podium system
- Speed bonuses
- Streak bonuses

### 7. Team Analytics

- Real-time team reports
- Post-session team reports
- Question-by-question breakdown
- CSV exports

### 8. Reusable Team Templates

- Save team configurations
- Apply saved configurations across sessions

### 9. Question Difficulty & Scoring

- Easy/Medium/Hard tags
- Configurable difficulty-based points

### 10. Custom Branding

- Customized LearnNPlay SVG favicon
- App metadata customization

### 11. Unequal-Team Average Scoring

- Team scoring method selector (total/average/accuracy)
- Balanced scoring for teams with different player counts
- Admin can choose scoring method per session

---

## 🚧 Pending Features / Roadmap

### 1. Subscription & Monetization System

- **Status**: 🔄 In Progress (Foundation Laid)
- **Description**:
  - Database schema created (user_roles, subscription_plans, subscriptions)
  - RLS policies implemented
  - Initial plans seeded (Starter, Pro Trainer monthly/yearly, Enterprise monthly/yearly)
  - Admin panel UI created at /admin/plans
  - Pricing page created at /pricing
  - Stripe SDK installed
  - Upgrade button added to dashboard
  - **Remaining Work**:
    - Complete Stripe checkout integration
    - Implement webhook handlers
    - Enforce subscription limits (participants, quizzes, language)
    - Add upgrade prompts for free users
    - Assign admin role to redmi.v1990@gmail.com

### 2. Live Full-System Simulation

- **Status**: Pending
- **Description**:
  - Comprehensive end-to-end testing of all features
  - Mobile responsiveness verification across all user flows

### 3. Production Deployment

- **Status**: Pending
- **Description**:
  - Deploy to production environment
  - Configure custom domain
  - Ensure production readiness

---

## 📋 Development Guidelines

### Before Building New Features

1. **Always check this ROADMAP.md first** to understand existing features
2. Review completed features to ensure no breaking changes
3. Check AGENTS.md for project-specific rules and patterns
4. Follow existing code conventions and architecture

### Key Architecture Notes

- Data lives in Lovable Cloud (Supabase)
- Quizzes store questions+translations as JSON on the quiz row
- Participants join without accounts (via public server functions)
- Live session logic in `src/lib/live.functions.ts`
- AI streaming logic in `src/lib/ai.server.ts` and `src/lib/quiz-ai.server.ts`
- Teams/gamification config on `live_sessions` table
- Team scores derived from server-written participant stats via `src/lib/teams.ts`
- Correct answers never sent to participants (revealed server-side only)

### Git Guidelines

- ⚠️ **IMPORTANT**: Do not rewrite published git history (no force pushes, rebasing, amending, or squashing pushed commits)
- This project is connected to Lovable - history rewrites can cause data loss
- Keep the connected branch in a working state at all times
