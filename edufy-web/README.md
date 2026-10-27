# Edufy Academy — Premium EdTech Frontend

## Architecture Overview

Edufy Academy is built with a modular, decoupled frontend architecture designed to interface cleanly with a future PHP REST API and MySQL database, with future parity for an Android application.

### Key Features Implemented:
1. **Public Marketplace**:
   - High-impact landing page with course search, popular categories, trending masterclasses, and certified mentor profiles.
   - Course marketplace with category, difficulty level, price filters, and grid/list view toggles.
   - Rich course details with learning outcomes, expandable curriculum syllabus, instructor bio, student reviews, and instant enrollment.
   - Digital certificate verification portal supporting cryptographic hash and credential ID lookup.
   - Technical blog with deep dives into software architecture and design craft.
   - About, Contact (with validated inquiry form), FAQ, Privacy, Terms, and 30-day refund policies.

2. **Authentication**:
   - Secure login and registration with Student / Instructor role switches.
   - 1-click Quick Demo Persona logins (Student, Instructor, Admin).
   - Password reset workflow.

3. **Student Learning Portal**:
   - Real-time progress tracking and study streaks.
   - Immersive video learning player with playback speeds, volume controls, scrub bar, and collapsible syllabus.
   - Dynamic lesson completion toggle with automatic course progress calculation.
   - Timestamped personal note-taking during lectures.
   - Interactive module quizzes with instant evaluation, score calculation, pass/fail status, and explanation review.
   - Verified digital certificates with modal preview and printing.
   - Wishlist management and profile settings.

4. **Instructor & Admin Consoles**:
   - Instructor Studio with gross earnings, student roster, and course drafting modal.
   - Super-Admin Console with user governance, account suspension toggles, catalog compliance audits, and financial payout transaction reports.

5. **Brand Design System**:
   - Primary blue: `#004AAD`
   - Secondary blue: `#5271FF`
   - Accent purple: `#5E17EB`
   - Background: `#F7F9FC`
   - White: `#FFFFFF`
   - Primary text: `#111827`
   - Secondary text: `#64748B`
   - Borders: `#E2E8F0`

### PHP REST API & MySQL Roadmap:
The centralized API service layer in `src/services/api.ts` connects to `VITE_API_BASE_URL` (defaulting to `/api/v1`), ready to switch seamlessly to live PHP REST endpoints via `VITE_USE_LIVE_API=true`.
