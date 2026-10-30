# Tsuki

Tsuki is a real estate marketplace with a React/Vite frontend and an Express/MongoDB API. Buyers can search and compare homes, save favorites, create search alerts, contact sellers, book viewings, review listings, and report concerns. Sellers can manage listings, photos, conversations, leads, and a viewing calendar. Admins can manage accounts and listings, review contact requests, and triage listing reports.

## Requirements

- Node.js 18 or newer
- MongoDB, local or hosted

## Run locally

Configure and start the API in one terminal:

```sh
cd backend
cp .env.example .env
# Set MONGODB_URI and replace JWT_SECRET in .env
npm install
npm run dev
```

Configure and start the frontend in another terminal:

```sh
cd frontend
cp .env.example .env
npm install
npm run dev
```

Vite serves the site at `http://localhost:5173`; the API listens on `http://localhost:5000`. Check the API with `http://localhost:5000/api/health`.

## Configuration and data

- Backend settings are in `backend/.env.example`. `MONGODB_URI` and a private `JWT_SECRET` are required for normal operation. Set `CLIENT_URL` to the frontend origin when hosting the API.
- Frontend `VITE_API_URL` is the API origin and defaults to `http://localhost:5000`.
- Uploaded listing photos are stored in `backend/uploads`. This directory is ignored by Git and must be backed up; deleting it removes the photos. Set `PUBLIC_API_URL` if the API's public origin differs from the request host, such as behind a reverse proxy.
- Listings, accounts, messages, viewings, reviews, and reports are stored in MongoDB. No demo listings or accounts are seeded.
- Email verification and email delivery are not configured. Contact form submissions are saved for admins to review; replies open the admin's email app.
- Sellers add 30-minute viewing slots from the Viewings page. Buyers request an open slot on the property page; it is reserved while pending and becomes available again if declined or cancelled. The calendar uses each user's local time.
- Confirmed visits appear in the Tsuki viewing schedule. Buyers and sellers can download an `.ics` event to import into Google Calendar, Apple Calendar, or another calendar app.
- Active listings show when availability was last confirmed. Sellers can reconfirm listings from the seller dashboard; listings unconfirmed for more than 30 days are flagged for buyers.
- Public seller profiles include active listings, seller reviews, Tsuki-reviewed listing counts, and response metrics based on recent buyer conversations.

## Accounts and administration

Registration supports buyer and seller accounts. Create the first admin account through a trusted database operation rather than public registration. Admins can review listings, verify them, manage accounts, set temporary passwords, process contact requests, and review listing reports at `/admin`. Users must change temporary passwords after signing in.

## Project structure

```text
Tsuki/
├── backend/
│   ├── middleware/    # Request middleware
│   ├── models/        # MongoDB models
│   ├── routes/        # API route handlers
│   └── utils/         # Backend helpers
├── frontend/
│   └── src/
│       ├── app/       # Route table, shell, and shared providers
│       ├── assets/    # Images and other static source assets
│       ├── features/  # Feature pages, dashboards, and components
│       └── styles/    # Shared base styles and feature stylesheets
├── eslint.config.js
└── package.json       # Shared format and lint commands
```

### Frontend source map

`frontend/src/main.jsx` boots the app and imports base and feature stylesheets. `app/App.jsx` owns the route table, and `app/Shell.jsx` contains the shared layout. App services are split into focused modules for the API, authentication, notifications, property tools, formatting, motion preferences, and chat updates. Feature route pages live in each feature's `pages/` folder; dashboards and shared components have their own named folders. See [`frontend/src/features/README.md`](frontend/src/features/README.md) for the feature map.

### Code style

The repository uses EditorConfig, Prettier, ESLint, and Stylelint. Install the root development tools with `npm install`, then use `npm run format` to format files, `npm run lint` to lint JavaScript/JSX and CSS, or `npm run format:check` to check formatting without changing files. Formatting uses two spaces, single quotes in JavaScript, semicolons, trailing commas, and a 100-character print width.

Use names and folder structure to make a file's purpose clear. Add brief comments for non-obvious behavior or decisions; avoid comments that only restate the code.
