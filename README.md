# Shoelotskey Service Management System
[![Tech Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20PostgreSQL-blue)](https://github.com/crg-philsca/shoelotskey-service-management-system)
[![Deployment](https://img.shields.io/badge/Deploy-Heroku-purple)](https://shoelotskey-villamor-pasay.herokuapp.com)

A professional-grade Service Management System tailored for **Shoelotskey Villamor Pasay**, designed for high-efficiency shoe restoration workflows. This project serves as a Bachelor of Science in Aviation IT Capstone at the **National Aviation Academy of the Philippines (NAAP)**.

## 🚀 Architectural Highlights

### 1. Dual-Postgres Engine (Development & Production)
The system implements a professional "Gold Standard" connection strategy:
- **Production**: Seamlessly integrates with **Heroku PostgreSQL** using mandatory SSL encryption.
- **Development**: Environment-aware configuration allows for local **Offline Development** (SQLite/Local Postgres) or direct connection to the live RDS cluster via secure `.env` orchestration.

### 2. 3NF Normalized Database Design
The core data layer adheres strictly to the **Third Normal Form (3NF)** to ensure zero data redundancy and maximum integrity. Features include:
- Centralized `ServiceCatalog` with dynamic category mapping.
- Atomic `Audit Logs` for real-time tracking of every system action.
- Relational mapping between Customers, Orders, and Items.

### 3. Enterprise-Grade Security
Built with defense-ready security features:
- **Login Defense**: Automated account locking after 3 failed attempts (15-minute cooldown) to mitigate brute-force attacks.
- **Dependency Inversion**: Using the factory pattern for database session management.
- **Verification vs Validation**: Strict Pydantic schema validation paired with business-logic verification.

## 🛠️ Tech Stack

- **Backend**: Python / FastAPI (High-performance asynchronous framework)
- **Frontend**: React / Vite / TailwindCSS / Lucide-React
- **Database**: PostgreSQL (3NF Schema) / SQLAlchemy ORM
- **Intelligence**: Integrated Prediction Engine for service duration estimates.

## 📖 Setup & Development

### Local Installation
```bash
# Install Node dependencies
npm install

# Start the Development Server (Frontend)
npm run dev

# Start the Backend (Windows)
.\run_backend.bat
```

### Environment Configuration
Create a `backend/.env` file:
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

---
*Created for the Shoelotskey Capstone Project - NAAP 2026*