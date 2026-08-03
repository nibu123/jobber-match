# Jobber Match — Setup Progress Log

Last updated: 30 July 2026

Ye file poora record hai ki kya-kya setup ho chuka hai, kahan hai, aur aage kya karna hai.
Isko project ke root mein (`jobber-match/SETUP.md`) save kar lo taaki dobara dhundna na pade.

---

## ✅ Ab tak jo ho chuka hai

### 1. Project Scaffold
- Backend: Node.js + Express + TypeScript + Socket.io + Redis pub/sub
- Frontend: React + Vite + TypeScript
- Local path: `C:\Users\user\Downloads\jobber-match-extracted\jobber-match`
- Structure: `backend/` aur `frontend/` folders, README.md root mein

### 2. GitHub
- Repo: **https://github.com/nibu123/jobber-match** (Private)
- Account use kiya: `nibu123` (⚠️ note: isi PC pe ek aur GitHub account `AmitB298` bhi hai — push karte waqt agar 403 error aaye to Credential Manager check karna, `cmdkey /list | findstr github`)
- Code push ho chuka hai (`main` branch, 39 files)
- Local repo already `origin` set hai — future changes ke liye bas:
  ```powershell
  cd C:\Users\user\Downloads\jobber-match-extracted\jobber-match
  git add .
  git commit -m "your message"
  git push
  ```

### 3. Supabase (PostgreSQL Database) — ✅ Live
- Project name: `jobber-match`
- Region: **Mumbai, India (ap-south-1)**
- Project ref: `basgfsiuufacapcpcgdc`
- Dashboard: https://supabase.com/dashboard/project/basgfsiuufacapcpcgdc
- Schema already run ho chuka hai (`backend/src/db/schema.sql`) — 6 tables live:
  `users`, `profiles`, `matches`, `messages`, `reports`, `blocks`
- Connection type used: **Transaction pooler** (URI format), host `aws-1-ap-south-1.pooler.supabase.com:6543`
- Password mein `@` symbol tha, isliye connection string mein **percent-encoded** (`@` → `%40`) — ye hamesha yaad rakhna agar password badlo
- Value `backend/.env` mein `DATABASE_URL` ke naam se saved hai

### 4. Upstash (Redis) — ✅ Live
- Database name: `jobber-match`
- Region: Mumbai, India (ap-south-1)
- Plan: Free Tier
- Endpoint: `informed-deer-173194.upstash.io:6379`
- Connection type used: **TCP / ioredis** format (`rediss://...`)
- Eviction: ON (safe hai — sirf storage limit cross hone par purana temporary data hatata hai; permanent data Postgres mein hai, Redis mein nahi)
- Value `backend/.env` mein `REDIS_URL` ke naam se saved hai

### 5. Cloudinary (Image Storage) — ✅ Live
- Cloud name: `zqpxtioe`
- Dashboard: https://console.cloudinary.com/app/c-f437739e32bf943c50eb149eff2528
- API Key aur Secret `backend/.env` mein saved hain (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- Abhi tak sirf credentials set hui hain — actual upload integration frontend mein test nahi hua

### 6. Local Backend — ✅ Tested & Working
- `.env` file complete hai: `backend/.env` (root .env.example se banayi gayi)
- `npm install` ho chuka hai (207 packages)
- `npm run dev` se successfully chal raha hai:
  ```
  🚀 Server running on port 4000
  ✅ Redis client connected
  ✅ Postgres connected
  ```
- Health check URL: `http://localhost:4000/health`

### 7. Local Frontend — ⏳ In Progress
- `npm install` + `npm run dev` abhi karna baaki hai (agle step mein)
- Expected URL: `http://localhost:5173`

---

## 🔐 Credentials Location (kahan save hain)

Sab kuch **`backend/.env`** file mein hai (ye file kabhi GitHub pe push nahi hoti, `.gitignore` mein already excluded hai). Values ye hain:
- `DATABASE_URL` — Supabase Postgres connection
- `REDIS_URL` — Upstash Redis connection
- `JWT_SECRET` — random secret for login tokens
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

⚠️ **Important habit**: aage se koi bhi password/token/secret seedha chat mein type na karna — sirf `.env` file mein hi daalna. Agar kabhi galti se chat mein type ho jaye, best practice yahi hai ki us credential ko turant reset/regenerate kar do (Supabase password reset, Cloudinary "Generate New API Key", etc.) taaki purana wala safe ho jaye.

---

## 🔜 Next Steps (jahan se continue karna hai)

1. **Frontend local pe run karna** — `cd frontend`, `npm install`, `npm run dev`, phir backend+frontend dono ek saath test karna (signup/login flow)
2. **Railway pe backend deploy karna** — GitHub repo se connect karke, `.env` values Railway ke "Variables" tab mein daalni hain
3. **Vercel pe frontend deploy karna** — `VITE_API_URL` env variable mein Railway ka backend URL daalna hai
4. **Railway ke `FRONTEND_URL` variable** ko Vercel URL se update karna (CORS ke liye zaroori)
5. **Privacy features add karna**:
   - Location fuzzing (exact GPS ki jagah approx distance)
   - Incognito mode ka actual UI/logic (schema mein column already hai)
6. Domain (optional, baad mein — Namecheap se)

---

## 📁 Local Project Path
```
C:\Users\user\Downloads\jobber-match-extracted\jobber-match
```

## 🌐 Important Links
| Service | URL |
|---|---|
| GitHub Repo | https://github.com/nibu123/jobber-match |
| Supabase Dashboard | https://supabase.com/dashboard/project/basgfsiuufacapcpcgdc |
| Upstash Dashboard | https://console.upstash.com/redis?teamid=0 |
| Cloudinary Dashboard | https://console.cloudinary.com/app/c-f437739e32bf943c50eb149eff2528 |
| Railway | (abhi setup nahi hua) |
| Vercel | (abhi setup nahi hua) |
