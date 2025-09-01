# Empowerment Hub – Full-Stack Starter (Front-end + Express + MySQL)

This starter pairs your existing `index.html` UI with a secure API. It includes user auth (JWT), cycle tracking storage, and a simple health Q&A stub.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- MySQL 8+ running locally (or a remote instance you control)

### 1) Database
Log into MySQL and create a database & user (optional, you can also use `root`):

```sql
CREATE DATABASE empower_hub DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'empower_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON empower_hub.* TO 'empower_user'@'localhost';
FLUSH PRIVILEGES;
```

Alternatively, run `db/schema.sql` in your MySQL client.

### 2) Backend (Express + MySQL)
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials

npm install
npm run start   # or: npm run dev
# Server: http://localhost:4000
# Health: http://localhost:4000/health
```

> On first run, the server creates the database (if not present) and tables.

### 3) Front-end
The backend can serve the front-end if you place the files under `frontend/` (already done here). While the backend is running, visit:
```
http://localhost:4000
```

If you prefer running the front-end separately, use VS Code "Live Server" or any static server. Ensure `API_URL` in `frontend/script.js` points to the backend (defaults to `http://localhost:4000`).

## API Overview

- `POST /api/auth/signup` `{ first_name, last_name, email, password, age, location }`
- `POST /api/auth/login`  `{ email, password }`
- `GET  /api/me` (Bearer token)
- `POST /api/cycles` (Bearer token) `{ last_period_date, cycle_length, period_duration }`
- `GET  /api/cycles/latest` (Bearer token)
- `POST /api/health/ask` `{ message }` – returns a general-info reply (no diagnosis).

Authorization: send header `Authorization: Bearer <token>` after login/signup.

## How to integrate your UI

1. Put `frontend/style.css` and `frontend/script.js` next to your `index.html` (already included).
2. The HTML already references `style.css` and `script.js` – no changes needed.
3. Start the backend, open the site, sign up, and log in. You should see the app shell with your name/location.

## Production Tips
- Change `JWT_SECRET` to a long random string.
- Use a dedicated MySQL user with least privileges and a strong password.
- Set CORS to your real origin.
- Behind a reverse proxy (Nginx), enable HTTPS.
- Consider input validation (celebrate/zod), rate limiting (express-rate-limit), and logging (pino).

## Project Structure
```
empower-hub-starter/
  backend/
    .env.example
    package.json
    server.js
  db/
    schema.sql
  frontend/
    index.html   # from your upload
    style.css
    script.js
```

Happy building! 🎉
