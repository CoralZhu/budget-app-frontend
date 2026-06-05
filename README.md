# budget-app-frontend

Vue 3 + Vite frontend for the AI Budget Assistant.

## 🚀 Local Development

```bash
git clone git@github.com:CoralZhu/budget-app-frontend.git
cd budget-app-frontend
npm install
cp .env.development.example .env.development  # or edit existing
npm run dev
```

Backend services required for full functionality:
- Spring Boot at `http://localhost:8080` (see budget-app-backend repo)
- Python Agent at `http://localhost:8001` (see budget-app-agent repo)

## 🔐 Environment Variables

```bash
# .env.development (local)
VITE_API_BASE_URL=http://localhost:8080
VITE_AGENT_BASE_URL=http://localhost:8001

# .env.production (Render)
VITE_API_BASE_URL=https://budget-app-backend-mubh.onrender.com
VITE_AGENT_BASE_URL=https://budget-agent-oi5z.onrender.com
```

## 📦 Build

```bash
npm run build       # Outputs to dist/
npm run preview     # Local preview of built output
```

## 📄 License

Personal portfolio project. No commercial use.
