# NeuroMarket Lite Documentation

This folder contains the project documentation for NeuroMarket Lite (emotion-aware trading simulator).

## Contents

- Overview & quick start: [SETUP.md](SETUP.md)
- System architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- API reference: [ENDPOINTS.md](ENDPOINTS.md)
- Database schema & relationships: [DATABASE.md](DATABASE.md)
- Backend internals: [BACKEND.md](BACKEND.md)
- Frontend internals: [FRONTEND.md](FRONTEND.md)
- Operational notes & common issues: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## What This Project Is

NeuroMarket Lite is a trading simulator that continuously monitors the user’s emotional state (via webcam) and uses that state to:

- gate trades (confirm / limit / block),
- score trading sessions (discipline + behavior),
- generate session reports,
- and surface “neuro” UI elements (Neuro-Pulse, emotion guard, markers) to encourage disciplined execution.

## Primary User Flows

- Sign up / log in (JWT auth).
- Start a trading session → trade stocks and options.
- Monitor live emotion (camera overlay + websocket).
- Review portfolio, trade history, sessions, leaderboard, and analytics.
- Admins can manage users and explore the database.
