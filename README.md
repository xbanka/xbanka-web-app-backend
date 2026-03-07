# XBanka Backend

The core backend system for the XBanka crypto and gift card trading platform. This repository is structured as a **NestJS Monorepo**, containing multiple microservices that communicate with each other.

## 🏗 Architecture

The backend consists of the following applications (found in the `/apps` directory):
- **Gateway (`gateway`)**: The main API entry point that routes requests to the appropriate microservices. Runs on port `3010`.
- **Auth Service (`auth-service`)**: Handles authentication, registration, and JWT token management. Runs on TCP port `3001`.
- **User Service (`user-service`)**: Manages user profiles, settings, and role-based access control. Runs on TCP port `3002`.
- **KYC Service (`kyc-service`)**: Handles Know Your Customer (KYC) identity verification flows. Runs on TCP port `3003`.

Shared code and database schemas are located in the `/libs` directory:
- **Common (`@app/common`)**: Shared DTOs, interfaces, filters, and utility functions.
- **Database (`@app/database`)**: Prisma schema, migrations, and database services.

---

## 🚀 Getting Started

### Prerequisites

To run this project, you will need:
- **Node.js** (v22+ recommended)
- **npm** (comes with Node)
- **Docker** (optional, for deployment)

### 1. Installation

Clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd xbanka-backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory. You can use a `.env.example` if one exists, but generally you need:

```env
# Database configuration
DATABASE_URL="file:./dev.db"  # Example using SQLite via LibSQL/Prisma
PORT=3000

# Add any other required secrets (JWT_SECRET, API keys, etc.)
```

### 3. Database Setup

This project uses Prisma ORM. Initialize the database by pushing the schema:

```bash
# Generate the Prisma client
npx prisma generate --schema=libs/database/prisma/schema.prisma

# Push the schema to the database (for development)
npx prisma db push --schema=libs/database/prisma/schema.prisma
```

### 4. Running the Application

Because this is a microservices architecture, you need to run the **Gateway** and all relevant **Services** simultaneously.

**The easiest way to start everything in development mode is:**

```bash
npm run start:all
```
*(This uses `concurrently` to spin up the Gateway, Auth, User, and KYC services at once, with auto-reloading enabled).*

Alternatively, you can start services individually:

```bash
# Start Gateway
npx nest start gateway --watch

# Start a specific microservice
npx nest start auth-service --watch
```

---

## 🧪 Testing

The repository contains unit and end-to-end tests using Jest.

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# View test coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

---

## 📚 API Documentation

Once the Gateway is running (usually on `http://localhost:3010`), you can view the Swagger API documentation by navigating to:

👉 **[http://localhost:3010/api/docs](http://localhost:3010/api/docs)**

---

## 🚢 Deployment

The project is designed to be easily deployed to a Linux server via Docker.

We use a single `docker-compose.yml` file that builds a multi-stage Docker image and runs all the microservices using host networking (`network_mode: "host"`). This ensures they can communicate over their hardcoded local TCP ports without modifying the application code.

### Deployment Script

A `deploy.sh` script is included in the repository to automate deployment to the production server.

**To deploy:**
1. Ensure your SSH key (`~/.ssh/id_ed25519_server`) has access to the target server.
2. Ensure your user is in the `docker` group on the target server.
3. Update your Redirect URIs in the Google Cloud Console to include `http://backend.xbankang.com/auth/google/callback`.
4. Run the deployment script from your local machine:

```bash
./deploy.sh
```

**What the script does:**
1. Uses `rsync` to copy the local codebase to the server (excluding `node_modules` and `dist`).
2. SSHs into the server.
3. Runs `docker compose build` and `docker compose up -d` to spin up the 4 containers:
   - `xbanka-gateway`
   - `xbanka-auth`
   - `xbanka-user`
   - `xbanka-kyc`

To view logs on the server:
```bash
docker compose logs -f
```

---

## 🛠 Useful Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Builds all applications within the monorepo. |
| `npm run format` | Runs Prettier to format codebase. |
| `npm run lint` | Runs ESLint to check for code issues. |

## License
Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
