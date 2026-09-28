# DeepLive

Real-time AI avatar video call platform. Users buy credit packs (minutes), run LiveCam sessions that transform their webcam in real-time, and route the output to any virtual-camera app (Zoom, Meet, OBS, Twitch, etc.).

## Tech Stack

- **Frontend:** Next.js 13 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **Payments:** Paystack checkout, plus manual payment review
- **Charts:** Recharts
- **Icons:** lucide-react

## Features

### User-facing
- Landing page with hero, features, pricing, testimonials, FAQ
- Email + password authentication (Supabase Auth)
- Dashboard with credit balance, quick-start, recent activity
- LiveCam workspace: camera selection, mock AI transform (canvas overlay), live timer with credit deduction, quality settings, watermark toggle, PiP, OBS instructions, session logging
- Billing page: buy credit packs via Paystack or Stripe (mock), purchase history
- Session history
- Tutorials library (free + premium, embedded video player)
- Account settings + referral code

### Admin panel
- Overview with revenue/user-growth charts and key metrics
- User management: search, view details, add/remove credits, ban/unban, delete
- Payments & transactions: filter by status/gateway, search
- Credit pack management: full CRUD with USD/NGN pricing, validity, discounts
- Session logs across the platform
- Tutorial management: full CRUD
- Site settings: site name, free trial duration, watermark text, maintenance mode, referral commission, payment gateway keys

## Database Schema

Tables (all with RLS enabled):
- `profiles` — user profile, role, credit balance, ban status, referral code (auto-created via trigger on signup)
- `credit_packs` — purchasable packs (Mini, Starter, Creator, Pro, Studio)
- `transactions` — payment records
- `sessions` — LiveCam session logs
- `tutorials` — video tutorials
- `settings` — single-row site settings

Admin access is enforced via a `is_admin()` SQL function that checks `profiles.role = 'admin'` and `banned = false`, used in RLS policies.

## Getting Started

The dev server runs automatically. Environment variables for Supabase are pre-configured. Paystack checkout also requires `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the server environment. Never expose the service-role key with a `NEXT_PUBLIC_` variable.

### Making a user an admin

After signing up, run this SQL in the Supabase dashboard to grant admin access:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

Then log out and back in. The "Admin Panel" link will appear in the dashboard sidebar.

## Notes

- The AI transformation in LiveCam is a mock (canvas color overlay + face-tracking placeholder). The architecture is ready to connect a real AI streaming endpoint via WebRTC.
- Paystack payments are verified server-side. Successful transactions are approved and credited automatically; manual payments remain pending until an admin approves them.
- Credit packs store minutes and credits separately. Usage deducts 125 credits per minute, so an 8-minute pack contains 1,000 credits.
