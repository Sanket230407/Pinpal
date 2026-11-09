# PinPal

Find people near you who share your interests, without revealing your exact location.

PinPal is a college web-development project: an Express server with a JSON-file database,
session login, and a plain HTML/CSS/JavaScript frontend. Chat messages arrive in real time
through Socket.IO.

## Features

- **Accounts**: sign up, log in and log out. Passwords are hashed with bcrypt.
- **Nearby**: share your location and see people within 1, 5, 10 or 25 km, as a list or on a map.
  Filter by interest.
- **Location privacy**: other people only see a distance label (such as `1.2 km`) and a map pin
  placed 200–400 m away from where you really are. Your real coordinates never leave the server.
- **Ghost Mode**: hide yourself from Nearby and hide when you were last active.
- **Connections**: send, accept, decline, cancel and remove connection requests.
- **Chat**: message your connections, with new messages delivered live.
- **Blocking**: blocked people can't find you, see your profile, or message you.

## Running it

You need Node.js 20.11 or newer.

```bash
npm install
cp .env.example .env      # then set SESSION_SECRET to a long random string
npm run seed              # adds demo users around Kota
npm start                 # or: npm run dev, which restarts on code changes
```

Open http://localhost:3000.

To place the demo users around your own location, pass its latitude and longitude:

```bash
npm run seed -- 19.07 72.88
```

Stop the server before seeding. The seed refuses to run while the server is running, because the
server would overwrite the new data with its own copy.

## Demo accounts

Every demo account uses the password `demo1234`. Log in as **asha** for the fullest demo: she has
connections, chats, and requests waiting in both directions.

| Username | What it shows |
| --- | --- |
| `asha` | Connections, chats, received and sent requests |
| `kunal`, `arjun`, `priya` | Asha's connections, with chat history |
| `rohan`, `neha` | Have sent Asha a request |
| `kabir` | In Ghost Mode, so never appears in Nearby |
| `tara` | Shared a location over 24 hours ago, so never appears in Nearby |

Demo locations count as fresh for about 18 hours, so run the seed again shortly before a demo.
Seeding again replaces only the demo data; accounts you created yourself are kept.

To see Nearby from a demo account, share a location close to the seed center. Your browser asks for
permission the first time.

## Project structure

```
server.js                 Creates the app, connects middleware and routes, starts the server
seed.js                   Fills the database with demo data
src/
  db.js                   The only file that reads or writes data/db.json
  socket.js               Socket.IO setup; delivers new messages to open tabs
  middleware/
    auth.js               requireAuth: rejects requests from logged-out users
    validate.js           Checks and cleans every request body
    rateLimit.js          Failed-login limit and one location update a minute
  routes/
    auth.js               /api/auth     signup, login, logout, session, me
    users.js              /api/users    profiles, editing your profile, Ghost Mode
    location.js           /api/location sharing your location
    nearby.js             /api/nearby   the people near you
    connections.js        /api/connections  requests and connections
    messages.js           /api/messages chat history and sending
    blocks.js             /api/blocks   blocking and unblocking
  utils/
    geo.js                Distances, fuzzed pins and distance labels
    relationships.js      Block and connection lookups shared by several routes
    serializers.js        publicUser and selfUser: which user fields leave the server
public/
  *.html                  One page per screen
  css/style.css           All styles
  js/                     One script per page, plus shared helpers (api, ui, nav, constants)
```

## API

Every route except signup, login and session needs a logged-in user.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create an account and log in |
| POST | `/api/auth/login` | Log in with email or username |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/session` | Is anyone logged in? (public) |
| GET | `/api/auth/me` | Your own account |
| PUT | `/api/users/me` | Edit name, bio, interests and avatar color |
| PUT | `/api/users/me/ghost` | Turn Ghost Mode on or off |
| GET | `/api/users/:id` | Someone's public profile |
| PUT | `/api/location` | Share your location (once a minute) |
| GET | `/api/nearby?radius=5&interest=Music` | People near you |
| GET | `/api/connections` | Your connections |
| GET | `/api/connections/requests` | Requests you received and sent |
| POST | `/api/connections/:userId` | Send a request |
| PUT | `/api/connections/:id/accept` | Accept a request |
| DELETE | `/api/connections/:id` | Decline, cancel or remove |
| GET | `/api/messages/:userId` | Chat history with a connection |
| POST | `/api/messages/:userId` | Send a message |
| GET | `/api/blocks` | People you blocked |
| POST | `/api/blocks/:userId` | Block someone |
| DELETE | `/api/blocks/:userId` | Unblock someone |

## Privacy and security notes

- Users leave the server only through `publicUser()` or `selfUser()`, so email, password hash and
  location can't be sent by accident.
- Nearby works out distances from real coordinates on the server and sends only a rounded label.
- The fuzzed pin stays the same unless you move more than 100 m, so averaging many pins can't
  reveal your real position. Location updates are limited to one a minute for the same reason.
- Someone who blocked you looks exactly like an account that doesn't exist.
- Session cookies are `httpOnly` and `sameSite=lax`, and the session id changes at login.
- Five failed logins from one IP address lock login for 10 minutes.
- Messages are only sent through `POST /api/messages`, so every message passes the same checks.
  The socket only delivers them.

## Tech stack

express, express-session, bcryptjs, socket.io, dotenv and nanoid, with nodemon for development.
The map uses Leaflet and OpenStreetMap tiles, loaded from a CDN.
