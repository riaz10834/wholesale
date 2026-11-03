# Wholesale-Brand — B2B Wholesale Ecommerce & Delivery Management

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime, Storage) · Google Maps.

## 1. Setup (about 10 minutes)

### Supabase
1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates all tables, RLS policies, triggers, RPC functions, realtime publication, and the `product-images` storage bucket.
3. **Authentication → Providers → Email**: for quick testing, turn off "Confirm email" (or keep it on and confirm by email).
4. **Project Settings → API**: copy the Project URL, `anon` key, and `service_role` key.

### Google Maps
In Google Cloud Console, create an API key and enable these APIs:
- Maps JavaScript API
- Directions API
- Geocoding API
- Places API

Restrict the key to your domains (`localhost:3000`, `*.vercel.app`, your domain).

### Environment
Copy `.env.example` to `.env.local` and fill in:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server only; used to create rider accounts) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Cloud Console |
| `NEXT_PUBLIC_CURRENCY` | e.g. `PKR`, `INR`, `USD` |
| `NEXT_PUBLIC_DEFAULT_LAT/LNG` | Map centre used before a location is picked |

### Run
```bash
npm install
npm run dev
```

### Create your admin account
1. Sign up at `/signup`.
2. In the Supabase SQL Editor, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Sign in again. You will be taken to `/admin`.

## 2. Test the full workflow
1. **Admin:** create categories, then products with variants, stock, and images.
2. **Admin → Delivery Team:** create a rider account (email and password).
3. **Customer:** sign up, add products (MOQ is enforced), check out with a GPS-pinned location.
4. **Admin → Orders:** confirm the order, move it through Preparing and Packed, then assign a rider.
5. **Rider:** on a phone, log in at `/login`, open the delivery panel, tap **Start shift**, and accept location consent. The phone then sends GPS every 12 seconds.
6. **Rider:** tap **Picked up — start delivery**. The order becomes *Out for Delivery*.
7. **Admin → Live Tracking** shows the rider moving, along with the destination, route, ETA, and online/offline status.
8. **Customer → My Orders → order** shows the rider live on the map with ETA and a **Call** button.
9. **Rider:** tap **Delivered** and enter the cash collected (a payment is recorded automatically), or **Failed** with a reason.
10. **Admin → Reports** shows sales, COGS, expenses, and net profit.

Browsers only allow GPS on **HTTPS** (or `localhost`). Test the rider panel on a phone using the deployed Vercel URL.

## 3. Deploy to Vercel
1. Push this folder to GitHub and import it in Vercel.
2. Add the same environment variables in Vercel → Project → Settings → Environment Variables.
3. Deploy. In Supabase → Authentication → URL Configuration, add your Vercel URL to Site URL / Redirect URLs.

## Architecture notes
- **Security:** RLS is enabled on every table. Orders are created only through the `place_order` RPC, which recomputes prices from the database, checks MOQ and stock with row locks, and decrements inventory in one transaction. Riders update status through `update_delivery_status` and send GPS through `push_location`. Both are ownership-checked server-side. Users cannot change their own role.
- **Live tracking:** each GPS fix is inserted into `delivery_locations` (history) and updates the rider's `profiles.last_*` columns. Admin and customer screens subscribe to Supabase Realtime. A customer can read the rider's location only while their own order is `out_for_delivery`, which RLS enforces.
- **Offline handling:** fixes taken while offline are queued and flushed on reconnect. A rider is shown as offline after 2 minutes without an update. Permission denial and GPS loss are reported in the UI.
- **Stock:** cancelling or returning an order automatically restocks inventory.
