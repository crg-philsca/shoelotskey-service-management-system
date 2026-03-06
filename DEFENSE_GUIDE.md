# Capstone Defense: Debugging & Configuration Guide

This document explains the core architectural changes made for security, verification, and defense-readiness.

## 1. Login Security (3 Attempt Limit)
**Where it's changed:** `backend/main.py` -> `login()` function.
**How it works:** 
- The `User` model (`backend/models.py`) contains `failed_login_attempts` and `locked_until`.
- Every failed request increments the counter.
- On the 3rd fail, `locked_until` is set to 15 minutes in the future.
- The system rejects all requests until the time expires or the owner manually resets the DB.
**How to fix/reset via phpMyAdmin:** If an account is locked, use **phpMyAdmin** to find the `shoelotskey_db` -> `users` table. Manually set `locked_until` to `NULL` (empty) or wait for the timer.

## 2. Password Reset (Email Simulation)
**Where it's changed:** `backend/main.py` -> `forgot_password()` and `reset_password()`.
**Simulation for Defense:**
- Since setting up a real SMTP server requires credentials, we generate a `uuid` token.
- In `ForgotPassword.tsx`, we catch this token and display a "Debug Link" on screen. This allows you to show the panel, simulate "checking email", and clicking the link to verify the reset flow works.
**SOLID Principle:** Handled via separate endpoints and schemas to ensure data integrity.

## 3. Data Seeding (Missing Content Fix)
**Where it's changed:** `backend/lib/initial_data.py` and `backend/main.py`'s `startup_event`.
**Issue:** If the content (Base Services, Add-ons) goes missing, it's likely because the database was reset.
**Fix:** The backend now automatically checks if the `services` table is empty on every GET request and re-seeds it from the mock data if necessary.

## 4. SOLID Principles Implementation
- **Single Responsibility:** Each backend router handles one domain (Orders, Services, Expenses).
- **Interface Segregation:** Defined clear Pydantic schemas in `schemas.py` to separate DB models from API response models.
- **Dependency Inversion:** Using `get_db` dependency in FastAPI to inject database sessions.

## 5. Verification vs Validation
- **Validation:** Controlled in `schemas.py` (e.g., ensuring `quantity` is an integer).
- **Verification:** Logic-based checks in `main.py` (e.g., verifying if a user exists before allowing a login).

## Contact for Fixes
If the connection fails:
1. Ensure `npm run dev` is running (Frontend).
2. Ensure `.\run_backend.bat` is running (Backend).
3. The API runs on `http://127.0.0.1:8000`.
