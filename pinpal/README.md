# 📍 PinPal

**Social media connectivity: find and connect with people near you.**

A web development college project built with **HTML, CSS, JavaScript, Node.js and Express**.

---

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd pinpal
npm install
npm start
```

Open **http://localhost:3000**

(Use `npm run dev` to auto-restart the server when you edit files.)

### Quick demo (recommended for presentations)

1. Sign up for an account.
2. On the **Nearby** tab, click **Use GPS** (or **Pick on map** and click anywhere).
3. Click **✨ Add demo people** - 10 fake people appear around you.
4. Click **+ Connect** on someone (demo people accept instantly), then open **Chats** and send a message. They reply automatically.

Demo people are visible only to you and can be deleted from the **Profile** tab.

### Deploy on Vercel

Vercel runs the server as short-lived serverless copies that don't share memory and can't write files, so `data/db.json` can't be used there. PinPal stores its data in **Upstash Redis** instead (free tier):

1. In your Vercel project open **Storage → Create Database → Upstash (Redis)** and connect it to the project. This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables. (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.)
2. In **Settings → Environment Variables** add `JWT_SECRET` with any long random text.
3. Redeploy.

Without the database, the API answers *"Database not set up"* instead of losing your account.

---

## Features

| Feature | What it does |
|---|---|
| Sign up / log in | Passwords hashed with bcrypt, sessions via JWT (7 days) |
| Location | Browser GPS, or click a spot on the map |
| Nearby people | Map + list sorted by distance, adjustable radius (1-50 km) |
| Filters | Search by name/username, filter by interest |
| Connections | Send, accept, decline, cancel requests; remove a connection |
| Chat | One-to-one messages between connections, unread badges, auto-refresh |
| Privacy | "Hide me" switch, and "approximate location" mode (position snapped to a ~500 m grid) |
| Profile | Name, bio, up to 8 interests |
| Responsive | Works on phone, tablet and desktop |

---

## Tech stack

- **Frontend:** plain HTML, CSS, JavaScript (no framework). [Leaflet](https://leafletjs.com) + OpenStreetMap for the map (loaded from a CDN, so the map needs internet).
- **Backend:** Node.js + Express REST API.
- **Storage:** locally, a JSON file (`data/db.json`), created automatically. You can open it to see exactly what is stored. On Vercel, an Upstash Redis database (see below).
- **Libraries:** `express`, `bcryptjs` (password hashing), `jsonwebtoken` (login tokens).

---

## Project structure

```
pinpal/
├── server.js              # starts Express, mounts routes, serves /public
├── package.json
├── src/
│   ├── db.js              # JSON-file database (load / save)
│   ├── geo.js             # Haversine distance, location snapping
│   ├── auth.js            # JWT helpers, requireAuth middleware, response shapes
│   └── routes/
│       ├── auth.js        # POST /register, /login
│       ├── users.js       # profile, location, /nearby
│       ├── connections.js # requests, accept, decline, remove
│       ├── messages.js    # chat
│       └── demo.js        # demo people helper
├── public/
│   ├── index.html         # landing page
│   ├── login.html
│   ├── register.html
│   ├── app.html           # main app (Nearby / Requests / Chats / Profile)
│   ├── css/style.css
│   └── js/
│       ├── api.js         # fetch wrapper, toast, helpers
│       └── app.js         # main app logic
└── data/db.json           # created on first run
```

---

## How "find people near me" works

1. The browser gets your coordinates (`navigator.geolocation`) or you click the map, and sends them to `PUT /api/me/location`.
2. `GET /api/nearby?radius=5` loops over visible users and computes the distance to each using the **Haversine formula** (great-circle distance on a sphere), see `src/geo.js`.
3. Users outside the radius are dropped, the rest are sorted by distance and returned.
4. For users who chose "approximate location", the server snaps their coordinates to a coarse grid **before** computing distance and before sending them, so the exact position never leaves the server.

---

## API reference

All routes except `/api/auth/*` need the header `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account `{name, username, email, password}` |
| POST | `/api/auth/login` | Log in `{email, password}` |
| GET | `/api/me` | My profile |
| PUT | `/api/me` | Update `{name, bio, interests, visible, precise}` |
| PUT | `/api/me/location` | Set location `{lat, lng}` |
| GET | `/api/nearby` | Query: `radius` (km), `interest`, `q` |
| GET | `/api/users/:id` | Public profile |
| GET | `/api/connections` | `{friends, incoming, outgoing}` |
| POST | `/api/connections/request` | `{userId}` |
| POST | `/api/connections/:id/accept` | Accept a request sent to me |
| POST | `/api/connections/:id/decline` | Decline a request sent to me |
| DELETE | `/api/connections/:id` | Cancel a request / remove a connection |
| GET | `/api/messages/summary` | Last message + unread count per chat |
| GET | `/api/messages/:userId` | Conversation (marks as read) |
| POST | `/api/messages/:userId` | Send `{text}` |
| POST / DELETE | `/api/demo` `/spawn` | Add / remove demo people |

---

## Security notes

- Passwords are hashed with bcrypt, never stored in plain text.
- User text is HTML-escaped before it is shown (prevents XSS).
- Emails and exact coordinates of approximate users are never sent to other users.
- You can only message people you are connected with.
- Before any real deployment: set a strong `JWT_SECRET` environment variable, use HTTPS, add rate limiting, and move from the JSON file to a real database (MongoDB / PostgreSQL).

## Ideas to extend

- Real database (MongoDB or PostgreSQL) instead of the JSON file
- Real-time chat with Socket.IO instead of polling
- Profile photos (upload with multer)
- Block / report users
- "Nearby events" or interest groups

---

*Made by: ____________________ &nbsp; Roll no: ____________ &nbsp; Course: Web Development*
