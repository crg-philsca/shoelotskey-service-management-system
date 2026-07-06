# 🎓 Shoelotskey Service Management System: Capstone Defense HandBook

This handbook serves as your script, codebase index, and theoretical guide to defending the technical architecture of the Shoelotskey Service Management System (SMS) v2.0 before the panel of professors.

---

## 1. 🛡️ Brute-Force Defense (3-Attempt Lockout)
* **Code Reference**: [main.py (login endpoint)](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L930) and [models.py (User model)](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/models.py#L25)
* **How It Works**:
  1. The `User` database table maintains state via `failed_login_attempts` (integer) and `locked_until` (timestamp) fields.
  2. On login failure, the system increments the failed count.
  3. Upon reaching the 3rd consecutive failure, `locked_until` is set to $T + 15\text{ minutes}$.
  4. The system blocks all subsequent requests immediately without hitting the password validation hash routine, preventing CPU exhaustion (Denial of Service).
* **Resetting in Defense Mode**: If an account gets locked during demonstration, open **phpMyAdmin** or your DB manager, locate the `users` table, and clear/nullify the `locked_until` column, or set `failed_login_attempts` back to `0`.

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"To address security requirements and prevent unauthorized account access, we implemented a stateful rate-limiting login defense. The system tracks failed attempts and locks out users for 15 minutes after 3 failures. We designed this defensively: when an account is locked, the authentication route fails fast before running the bcrypt hash comparison. This protects the backend from CPU exhaustion attacks, as cryptographic hashing is computationally expensive. This demonstrates our implementation of secure software engineering principles rather than just basic login forms."*

---

## 2. 📧 Password Recovery (Hybrid SMTP Mocking)
* **Code Reference**: [main.py (forgot_password & reset_password)](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L975-L1020) and [ForgotPassword.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/ForgotPassword.tsx)
* **How It Works**:
  1. Rather than hardcoding mail server credentials in the repository, the backend runs a hybrid recovery bridge.
  2. When the user requests a reset, the server generates a cryptographically secure token using standard UUIDv4.
  3. If no external SMTP server is active (e.g. running locally), the token is logged directly in the terminal console and captured by the frontend debug console, displaying a safe "Demo Mode Recovery Link".

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"During local development and offline environments, hardcoding email server credentials is a severe security risk and creates deployment dependencies. To solve this, we implemented a hybrid recovery bridge. When running in a local environment, the system generates a secure token and outputs it to the server logs and terminal, showing a 'Demonstration Recovery Link' on screen. This allows the verification of the complete security token lifecycle—including token creation, expiry checks, and hashing—without relying on external network dependencies or exposing SMTP passwords in the codebase."*

---

## 3. 🔄 Autonomous Seed-Recovery System
* **Code Reference**: [main.py (startup_sequence)](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L206-L230) and [initial_data.py](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/lib/initial_data.py)
* **How It Works**:
  1. The system features a self-healing configuration. During startup, the backend verifies database structures and checks lookup counts.
  2. If base catalogs, priority levels, or status definitions are completely absent, the backend automatically seeds them from `initial_data.py` to guarantee high availability.

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"To ensure high system reliability and a zero-configuration boot sequence, we engineered an Autonomous Seed-Recovery System. If database content—such as lookup categories, status states, or services—is missing, the system detects this at startup and re-seeds itself from initial mock configurations. This represents the high-availability paradigm, guaranteeing that the application is functional and resilient against accidental database truncation or clean installs."*

---

## 4. 🧩 SOLID Principles & Architecture
* **Single Responsibility Principle (SRP)**:
  * *Code Proof*: Routers are segregated by domain: inventory endpoints sit in `/api/inventory` (Inventory), orders sit in `/api/orders` (Orders), and expenses sit in `/api/expenses` (Expenses).
* **Interface Segregation Principle (ISP)**:
  * *Code Proof*: Distinct separation between Pydantic input models (e.g., [InventoryUpdateSchema](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/schemas.py#L316) which permits partial updates) and output database representations ([InventorySchema](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/schemas.py#L292)).
* **Dependency Inversion Principle (DIP)**:
  * *Code Proof*: Database connections are not hardcoded. Database sessions are injected dynamically into routes via FastAPI's `Depends(get_db)`.

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"We strictly followed SOLID design principles to make our software architecture modular and maintainable. For Single Responsibility, the controllers are separated by service domains. For Interface Segregation, we separated database structures from API payload contracts by using distinct Pydantic models. For Dependency Inversion, we decoupled the route controllers from database drivers by injecting session dependencies dynamically via FastAPI's dependency injection container. This decouples database connections and simplifies unit testing."*

---

## 5. 🔍 Verification vs Validation
* **Validation (Syntactical Checks)**:
  * *Code Proof*: Controlled automatically at schema boundaries by Pydantic (e.g., `stock_quantity: float` or `unit_price: Decimal`).
* **Verification (Semantic/Logic Checks)**:
  * *Code Proof*: Business logic checks inside main route handlers (e.g., verifying if the user has sufficient permissions, checking if a username is already taken, or validating if duplicate stock logs exist before auto-deducting).

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"We implemented a clear distinction between validation and verification. Validation is structural and syntactical—it ensures incoming data conforms to exact type signatures, which is verified automatically by Pydantic models at the API boundary. Verification is semantic and logic-based—it confirms that state transitions comply with business rules. For example, before executing stock consumption, we verify that an adjustment log for the order has not already been generated, which prevents duplicate deductions."*

---

## 6. 🧪 Automated Inventory Consumption & Package Sizing
* **Code Reference**: 
  * *Database schema columns*: [models.py](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/models.py) (`auto_deduct`, `auto_deduct_trigger`, `trigger_service`, `consumption_qty`, `package_size`).
  * *Status Change Triggers*: [main.py (update_order)](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/backend/main.py#L1705-L1775).
  * *Table Rendering*: [Inventory.tsx](file:///c:/Users/charm/Desktop/Shoelotskey%20Service%20Management%20System/src/app/pages/Inventory.tsx#L394-L413).
* **How It Works**:
  1. **Dual-Unit Parity**: Stock can be purchased in bulk containers (e.g. 4L *Bottle*, 260g *Tub*) but consumed in precise internal units (e.g. `150 mL` for cleaning, `10g` for conditioner). The system displays both remaining internal units (e.g. `3850 mL`) and estimated bulk packages (e.g. `~0.96 Bottle`).
  2. **Dynamic Warn Levels**: Low Stock indicators dynamically evaluate remaining stock against the item's `package_size` limit. If the stock drops below **1 package** (its `package_size`, or `1` if unset), it triggers a `Low Stock` status.
  3. **Trigger-Based Actions**: When an order transitions to `on-going` ("Job Started") or `for-release`/`claimed` ("Shoe Released"), the backend scans the inventory for auto-deduction items that match the trigger and service, decrementing the stock level automatically.
  4. **Parity Migration**: Database migrations execute on both the active database and the local SQLite database file, keeping schema definitions in sync and preventing columns from being stripped during synchronization.

> [!TIP]
> 🎤 **Verbal Defense Script (What to Say to the Panel)**:
> *"To minimize human error and automate supply chain tracking, we implemented an Automated Inventory Consumption engine. The system allows stock to be configured in purchase units but tracked in internal measurement units (like milliliters and grams). The low stock alert system dynamically scales based on package size. If stock drops below one container capacity (for example, below 4000 mL for Cleaner), a 'Low Stock' alert is raised. Furthermore, deductions are tied to state transitions: when an order moves to 'on-going' or 'for-release', the system automatically deducts corresponding material quantities (like 150 mL of Cleaner) for the requested services. This ensures that digital inventory aligns in real-time with physical utilization."*
