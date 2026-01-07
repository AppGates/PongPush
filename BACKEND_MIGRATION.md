# 🔄 Backend Migration Guide

Diese Anleitung zeigt, wie Sie die Business Logic von der Frontend-App in ein separates Backend verschieben können.

## 📐 Aktuelle Architektur (Frontend-only)

```
Browser
  ├── UI Layer (src/ui/)           # DOM manipulation
  ├── Business Logic (src/services/) # Validation, Upload orchestration
  └── GitHub API (src/services/GitHubApiClient.ts)
```

**Alle Schichten laufen im Browser!**

## 🎯 Ziel-Architektur (Frontend + Backend)

```
Browser (Frontend)                     Backend (Node.js/Bun/Deno)
  ├── UI Layer                          ├── API Routes
  └── API Client ────HTTP───>           ├── Business Logic (src/services/)
                                        └── GitHub API Client
```

## 📦 Was kann verschoben werden?

### ✅ Backend-ready (keine Änderungen nötig):

- **`src/models/`** → Shared DTOs zwischen Frontend & Backend
- **`src/services/ValidationService.ts`** → Reine Business Logic
- **`src/services/GitHubApiClient.ts`** → GitHub API Abstraktion
- **`src/services/UploadService.ts`** → Upload-Orchestrierung
- **`src/config/AppConfig.ts`** → Konfiguration (mit env vars)

### 🔧 Frontend bleibt (mit Anpassungen):

- **`src/ui/`** → Bleibt, aber ruft REST API statt Services
- **`src/main.ts`** → Bleibt, initialisiert nur UI

## 🚀 Schritt-für-Schritt Migration

### Schritt 1: Backend-Projekt aufsetzen

Erstellen Sie ein neues Backend-Projekt (z.B. mit Express, Fastify, Hono):

```bash
mkdir pongpush-backend
cd pongpush-backend
npm init -y
npm install express @octokit/rest
npm install -D typescript @types/node @types/express
```

### Schritt 2: Services kopieren

Kopieren Sie die kompletten Service-Ordner:

```bash
# Von Frontend zu Backend
cp -r ../PongPush/src/models ./src/
cp -r ../PongPush/src/services ./src/
cp -r ../PongPush/src/config ./src/
```

**Keine Code-Änderungen nötig!** Die Services sind bereits backend-ready.

### Schritt 3: Backend-Konfiguration anpassen

**`src/config/AppConfig.ts`** (Backend):

```typescript
export function getConfig(): AppConfig {
  const config = { ...defaultConfig };

  // Read from environment variables
  config.github.token = process.env.GITHUB_TOKEN;
  config.github.owner = process.env.GITHUB_OWNER || 'AppGates';
  config.github.repository = process.env.GITHUB_REPO || 'PongPush';

  return config;
}
```

### Schritt 4: REST API Endpoint erstellen

**`src/routes/upload.ts`** (Backend):

```typescript
import { Router } from 'express';
import multer from 'multer';
import { UploadService } from '../services';
import { getConfig } from '../config/AppConfig';
import { UploadRequest } from '../models';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize service
const config = getConfig();
const uploadService = new UploadService(config);

// Upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', details: 'No file uploaded' },
      });
    }

    // Convert multer file to File-like object
    const file = new File([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype,
    });

    // Create upload request (same DTO as frontend!)
    const uploadRequest: UploadRequest = {
      file,
      metadata: {
        timestamp: new Date(),
      },
    };

    // Use the SAME service as frontend!
    const response = await uploadService.upload(uploadRequest);

    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', details: error.message },
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  const health = await uploadService.healthCheck();
  res.json(health);
});

export default router;
```

**`src/server.ts`** (Backend):

```typescript
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', uploadRouter);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

### Schritt 5: Frontend anpassen

**`src/ui/UploadForm.ts`** (Frontend - VORHER):

```typescript
// Direct service call
const response = await this.uploadService.upload(request);
```

**`src/ui/UploadForm.ts`** (Frontend - NACHHER):

```typescript
// REST API call
const formData = new FormData();
formData.append('file', request.file);

const response = await fetch('http://localhost:3001/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
```

**`src/main.ts`** (Frontend - anpassen):

```typescript
// Remove service initialization
// const uploadService = new UploadService(config);

// Initialize UI only
new UploadForm(); // No service dependency!
```

### Schritt 6: Erstellen Sie einen API Client

**`src/api/ApiClient.ts`** (Frontend - NEU):

```typescript
import { UploadRequest, UploadResponse } from '../models';

export class ApiClient {
  constructor(private baseUrl: string) {}

  async upload(request: UploadRequest): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', request.file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return response.json();
  }
}
```

## 🔐 Umgebungsvariablen

### Backend (`.env`):

```bash
GITHUB_TOKEN=ghp_your_fine_grained_token_here
GITHUB_OWNER=AppGates
GITHUB_REPO=PongPush
PORT=3001
```

### Frontend (Keine Secrets mehr!):

```bash
VITE_API_URL=http://localhost:3001
# oder in Produktion:
VITE_API_URL=https://api.pongpush.com
```

## ✅ Vorteile der Migration

| Aspekt | Vorher (Frontend-only) | Nachher (Frontend + Backend) |
|--------|----------------------|----------------------------|
| **Security** | Token im Browser sichtbar | Token nur im Backend |
| **Code Reuse** | ❌ | ✅ Services wiederverwendet |
| **Validation** | Nur im Browser | Browser + Server (doppelt) |
| **Testing** | Schwierig | Einfach (Unit tests für Services) |
| **Skalierung** | GitHub API Limits pro Token | Rate limiting möglich |

## 📊 Migration Checklist

- [ ] Backend-Projekt erstellen
- [ ] `src/models/`, `src/services/`, `src/config/` kopieren
- [ ] Backend-Konfiguration für `process.env` anpassen
- [ ] REST API Endpoints implementieren
- [ ] Frontend API Client erstellen
- [ ] `UploadForm.ts` auf API Client umstellen
- [ ] `main.ts` anpassen (keine Services mehr)
- [ ] Environment Variables konfigurieren
- [ ] Backend deployen (Vercel, Railway, Fly.io)
- [ ] Frontend `VITE_API_URL` setzen
- [ ] Testen!

## 🎯 Beispiel Deployment

### Backend:

```bash
# Vercel
vercel --prod

# Railway
railway up

# Fly.io
fly deploy
```

### Frontend (unverändert):

```bash
# GitHub Pages
git push origin main
```

## 💡 Best Practices

1. **Shared Models**: Erstellen Sie ein `@pongpush/shared` npm Package für DTOs
2. **API Versioning**: Nutzen Sie `/api/v1/upload` für Breaking Changes
3. **Error Handling**: Zentrale Error-Handler im Backend
4. **Rate Limiting**: Nutzen Sie `express-rate-limit`
5. **CORS**: Konfigurieren Sie allowed origins

## 🔍 Wichtige Hinweise

- **Keine Service-Änderungen nötig!** Die Business Logic funktioniert 1:1 im Backend
- **DTOs bleiben gleich!** `UploadRequest` und `UploadResponse` werden geteilt
- **File Handling**: Im Backend nutzen Sie `multer`, `formidable`, oder `busboy`
- **Token Security**: Im Backend sind Tokens sicher in Environment Variables

---

**Fragen?** Schauen Sie in die Service-Implementierungen - sie sind bereits mit TODO-Kommentaren für die Migration versehen!
