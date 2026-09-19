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
## Preview
<img width="1366" height="1155" alt="image" src="https://github.com/user-attachments/assets/6d94e3e4-81ec-44b6-8705-e17250605c1a" />
<img width="1366" height="4018" alt="image" src="https://github.com/user-attachments/assets/ca52c399-ce83-4b8c-98ab-4fed71d7e385" />
<img width="1366" height="1285" alt="image" src="https://github.com/user-attachments/assets/d1b3582b-d13f-4261-8fb7-c5d719ca07ed" />
<img width="1366" height="651" alt="image" src="https://github.com/user-attachments/assets/c901edaf-d486-4984-9fb8-edda60b9a581" />
<img width="1366" height="651" alt="image" src="https://github.com/user-attachments/assets/fbcd462f-bb56-4f81-9c55-6c8b7ba0f975" />


