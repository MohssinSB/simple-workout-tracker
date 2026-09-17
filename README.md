# 🏋️‍♂️ Workout Progress Tracker

A lightweight, local-first web application designed to log gym workouts, track weight progression, and categorize exercises by muscle groups.

This project bridges data extraction (parsing legacy text notes) with a full-stack architecture, and is evolving toward a fully offline, installable Android app.

## ⚙️ Tech Stack
* **Database:** SQLite (Lightweight, local relational data)
* **Backend:** Python (FastAPI, served via uvicorn) — REST API over SQLite
* **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Mobile-first design), Chart.js for progress visualization
* **Packaging (in progress):** Capacitor, to ship the frontend as a real installable `.apk`, with the database moving fully on-device (no server dependency)

## 📋 Features
- [x] **Progress Tracking:** Log sets, reps, and weight per exercise, with full historical persistence in SQLite.
- [x] **Muscle Group Filtering:** Exercises are grouped and filtered by muscle group (e.g., Legs, Chest, Back) instead of one flat list.
- [x] **Progress Charts:** Per-exercise chart toggling between max weight and total volume (weight × reps) across sessions.
- [x] **Mobile-Ready Interface:** Responsive, PWA-installable design (manifest + icon) meant to be used on a smartphone during workout sessions.
- [ ] **Legacy Data Importer:** Python script using `Regex` to parse and import historical workout data from raw `.txt` notes into the database — written, not yet validated against real notes.
- [ ] **Standalone Android App:** Package the frontend with Capacitor and move the database fully on-device (SQLite via Capacitor), removing the dependency on a running backend — in progress.

## 🗺️ Development Roadmap
- **Phase 1 (done):** SQL schema design & database initialization.
- **Phase 2 (done):** REST API development (FastAPI) — full CRUD over groups, exercises, and logged sets.
- **Phase 3 (done):** Frontend UI/UX implementation, connected to the live API.
- **Phase 4 (pending validation):** Legacy text parser (Python) — needs testing against real notes.
- **Phase 5 (in progress):** Migrate the data layer to on-device SQLite (via Capacitor) so the app runs with no backend at all.
- **Phase 6 (planned):** Package as a distributable `.apk` for Android, installable and shareable without any setup on the recipient's end.

---
*Developed as a personal portfolio project focusing on full-stack architecture and data processing.*
