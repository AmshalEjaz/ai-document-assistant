# PaperMind frontend

A React + TypeScript + Vite frontend for the AI Document Assistant.

## Run

```powershell
npm install
npm run dev
```

The app defaults to FastAPI at `http://127.0.0.1:8000`.

Expected future endpoints:
- `POST /api/documents/upload` with multipart field `file`
- `POST /api/chat` with JSON `{ "message": "...", "document_name": "..." }`

Until those endpoints are built, the UI automatically falls back to preview mode so the design can be tested immediately.
