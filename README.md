# Jobber Match — LGBTQ+ Matchmaking & Social App

Web MVP scaffold: React (frontend) + Node/Express/TypeScript (backend) +
PostgreSQL (Supabase) + Redis (Upstash) + Cloudinary (images).

---

## 1. Local Setup (pehle ye karo)

### Backend
```bash
cd backend
npm install
cp .env.example .env
# .env mein DATABASE_URL, REDIS_URL, JWT_SECRET, Cloudinary keys bharo (neeche steps hain)
npm run dev
```
Backend `http://localhost:4000` pe chalega. Test: `http://localhost:4000/health`

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:4000 (already set)
npm run dev
```
Frontend `http://localhost:5173` pe chalega.

---

## 2. Supabase (Database) — Free

1. [supabase.com](https://supabase.com) pe account banao → **New Project**
2. Project settings → Database → **Connection String** (URI mode) copy karo
3. Ye string `backend/.env` ke `DATABASE_URL` mein daalo (password wahi use karo jo project banate waqt set kiya tha)
4. Supabase dashboard → **SQL Editor** → New Query → `backend/src/db/schema.sql` ka pura content paste karke **Run** karo
5. Table Editor mein check karo — `users`, `profiles`, `matches`, `messages`, `reports`, `blocks` tables ban jayenge

---

## 3. Upstash (Redis) — Free

1. [upstash.com](https://upstash.com) pe account banao → **Create Database** → Region apne backend ke paas wala choose karo (e.g. ap-south-1 agar Railway India-close region use kar rahe ho)
2. Database open karo → **"ioredis" connect tab** se `rediss://...` URL copy karo
3. `backend/.env` ke `REDIS_URL` mein daalo

---

## 4. Cloudinary (Image Storage) — Free

1. [cloudinary.com](https://cloudinary.com) pe account banao
2. Dashboard se `Cloud Name`, `API Key`, `API Secret` copy karo
3. `backend/.env` mein daalo

---

## 5. Deploy Backend → Railway

1. [railway.app](https://railway.app) pe GitHub se login karo
2. **New Project → Deploy from GitHub repo** → apna repo select karo, root directory `/backend` set karo
3. Railway ke **Variables** tab mein wahi saare `.env` values daalo (DATABASE_URL, REDIS_URL, JWT_SECRET, CLOUDINARY_*, FRONTEND_URL — ye Vercel deploy hone ke baad milega)
4. Build command: `npm run build`, Start command: `npm start` (Railway usually auto-detect kar leta hai)
5. Deploy hone ke baad Railway ek public URL dega (e.g. `https://jobber-match-backend.up.railway.app`) — ye copy karlo, frontend ke `VITE_API_URL` mein use hoga

⚠️ Railway free tier: $5/month credit milta hai, chalu rehta hai (Render jaisa cold-start nahi hota), lekin credit khatam hone ke baad app pause ho sakta hai — MVP testing ke liye kaafi hai.

---

## 6. Deploy Frontend → Vercel

1. [vercel.com](https://vercel.com) pe GitHub se login karo
2. **New Project** → repo select karo → root directory `/frontend` set karo
3. Environment Variables mein `VITE_API_URL` = tumhara Railway backend URL daalo
4. Deploy → Vercel apna URL dega (e.g. `https://jobber-match.vercel.app`)
5. Wapas Railway pe jaake `FRONTEND_URL` variable is Vercel URL se update karo (CORS ke liye zaroori hai)

---

## 7. Domain (Optional, baad mein)

Namecheap se domain lekar Vercel/Railway ke custom domain settings mein add kar sakte ho jab MVP validate ho jaye.

---

## Project Structure

```
backend/
  src/
    server.ts          # Entry point, Express + Socket.io setup
    db/
      pool.ts           # Postgres connection pool
      redis.ts          # Redis (Upstash) client
      schema.sql         # Run this in Supabase SQL Editor
    routes/
      auth.ts            # Signup/login (JWT + bcrypt)
      profiles.ts         # Create/update/browse profiles
      matches.ts          # Send/accept match requests
      messages.ts          # Chat history
      safety.ts             # Report/block
    socket/
      chat.ts                # Real-time chat via Socket.io + Redis pub/sub
    middleware/
      auth.ts                  # JWT verification middleware

frontend/
  src/
    pages/
      Login.tsx, Signup.tsx, Browse.tsx
    context/
      AuthContext.tsx           # Global auth state
    api/
      client.ts                  # Axios/fetch wrapper
      socket.ts                   # Socket.io client setup
    components/
      TabBar.tsx
```

---

## Safety Notes (important — mat skip karna)

- `incognito_mode` column already schema mein hai — profile ko hide karne ka option
- Reports/Blocks tables se moderation possible hai — ek admin dashboard v2 mein banana
- Location fuzzing abhi implement nahi hua — production se pehle exact lat/lng ki jagah rounded/approx values return karo API se
- JWT_SECRET production mein long random string honi chahiye — kabhi bhi GitHub pe commit mat karna `.env` file ko (`.gitignore` mein already hai)

---

## Next Steps (v2 ideas)
- Photo verification (selfie match)
- Group/community chat rooms
- Push notifications
- Admin moderation dashboard
