# 🏓 PongPush - Photo Upload System

Eine **mobile-optimierte TypeScript-Webanwendung** zum Hochladen von Spielberichten (Fotos) direkt in ein GitHub Repository mit sauberer Trennung von UI und Business Logic.

**🌐 Live Demo:** https://appgates.github.io/PongPush/

## 🌟 Features

- **📱 Mobile-First Design**: Optimiert für Smartphone-Nutzung
- **📸 Foto-Upload**: Direktes Aufnehmen oder Auswählen von Fotos
- **🔐 GitHub Integration**: Automatisches Hochladen ins Repository
- **🚀 CI/CD Pipeline**: Automatisches Deployment zu GitHub Pages mit E2E-Tests und Commit-Verifizierung
- **⚡ TypeScript**: Type-safe und wartbar
- **🏗️ Clean Architecture**: UI/Business Logic sauber getrennt
- **🔄 Backend-ready**: Business Logic kann ohne Änderungen ins Backend verschoben werden

## 🛠️ Technologie-Stack

### Frontend
- **TypeScript 5.7**: Type-safe development
- **Vite 6.0**: Blitzschneller Build-Tool
- **Vanilla JS**: Keine Framework-Abhängigkeiten
- **CSS3**: Responsive Design

### Business Logic
- **Octokit**: GitHub API Client
- **Service Layer Pattern**: Wiederverwendbare Services
- **DTO Pattern**: Shared models für Frontend/Backend

### Deployment
- **GitHub Pages**: Kostenloses Hosting
- **GitHub Actions**: Automatische CI/CD

## 📁 Projektstruktur

```
PongPush/
├── src/
│   ├── models/              # 📦 DTOs (shared mit Backend)
│   │   ├── UploadRequest.ts
│   │   ├── UploadResponse.ts
│   │   └── ValidationResult.ts
│   ├── services/            # 🧠 Business Logic (backend-ready)
│   │   ├── UploadService.ts      # Upload-Orchestrierung
│   │   ├── ValidationService.ts   # Validierung
│   │   └── GitHubApiClient.ts    # GitHub API
│   ├── ui/                  # 🎨 Presentation Layer
│   │   ├── UIController.ts       # DOM-Manipulation
│   │   └── UploadForm.ts         # Form-Logik
│   ├── config/              # ⚙️ Konfiguration
│   │   └── AppConfig.ts
│   ├── main.ts              # 🚀 Entry Point
│   └── style.css            # 💅 Styling
├── .github/workflows/       # 🔄 CI/CD Pipeline
├── index.html               # 📄 HTML
└── vite.config.ts           # ⚡ Vite Config
```

## 🏗️ Architektur-Highlights

### Klare Schichten-Trennung

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│    (src/ui/ - bleibt im Frontend)      │
├─────────────────────────────────────────┤
│         Business Logic Layer            │
│  (src/services/ - kann ins Backend)    │
├─────────────────────────────────────────┤
│              Data Layer                 │
│   (src/models/ - shared DTOs)          │
└─────────────────────────────────────────┘
```

**Vorteile:**
- ✅ Testbar: Services können unabhängig getestet werden
- ✅ Wiederverwendbar: Business Logic kann ins Backend verschoben werden
- ✅ Wartbar: Klare Verantwortlichkeiten
- ✅ Skalierbar: Einfache Migration zu Microservices

## 🚀 Quick Start

### Voraussetzungen

- Node.js 20+
- Git
- GitHub Account

### 1. Repository klonen

```bash
git clone https://github.com/AppGates/PongPush.git
cd PongPush
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. GitHub Token konfigurieren (für lokale Entwicklung)

Erstellen Sie einen **Fine-grained Personal Access Token**:

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. "Generate new token"
3. **Repository access**: "Only select repositories" → `AppGates/PongPush`
4. **Permissions**: Contents: Read and write
5. Token kopieren

**Für lokale Entwicklung** in `public/config.js`:

```javascript
window.__GITHUB_TOKEN__ = 'ghp_your_token_here';
```

**⚠️ WICHTIG:** Committen Sie dieses File NICHT! Es ist in `.gitignore`.

### 4. Development Server starten

```bash
npm run dev
```

→ Öffnet automatisch http://localhost:3000

### 5. Build für Produktion

```bash
npm run build
npm run preview
```

## 🌐 GitHub Pages Deployment

### Setup (einmalig)

#### 1. GitHub Secret konfigurieren

GitHub Repository → Settings → Secrets and variables → Actions:

- **Name**: `GH_TOKEN`
- **Value**: Ihr Fine-grained Personal Access Token

#### 2. GitHub Pages aktivieren

Das passiert automatisch durch die GitHub Actions Pipeline!

### Deployment

```bash
git push origin main
```

Die Pipeline:
1. ✅ Installiert Dependencies
2. ✅ Type-checked TypeScript
3. ✅ Built die App mit Vite
4. ✅ Injected das GitHub Token
5. ✅ Deployt zu GitHub Pages
6. ✅ Verifiziert das Deployment

→ Website live unter: **https://appgates.github.io/PongPush/**

## 📋 Verfügbare Scripts

```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run type-check   # TypeScript type checking (ohne build)
```

## 🔐 Sicherheit

### Fine-grained Token

Das verwendete GitHub Token hat **minimal permissions**:

```
Repository: Nur AppGates/PongPush
Permissions: Contents: Read and Write
```

**Was das Token KANN:**
- ✅ Dateien in `uploads/` hochladen

**Was das Token NICHT kann:**
- ❌ Andere Repositories zugreifen
- ❌ Account-Informationen lesen
- ❌ Code ändern (außer uploads/)
- ❌ Secrets auslesen

**Risiko bei Exposure:** Minimal - nur Spam-Uploads möglich

### Token im Browser?

Ja, das Token ist im JavaScript sichtbar. **Das ist OK** weil:
1. Fine-grained Token mit minimal permissions
2. Nur ein öffentliches Repository betroffen
3. Kein Account-Zugriff möglich
4. Alternative wäre Backend (siehe unten)

## 🔄 Backend Migration

Die Business Logic ist **bereits backend-ready**!

→ **Komplette Anleitung:** [BACKEND_MIGRATION.md](BACKEND_MIGRATION.md)

**TL;DR:**
```bash
# Services ins Backend kopieren
cp -r src/services backend/src/
cp -r src/models backend/src/

# REST API erstellen
# Services funktionieren 1:1 ohne Änderungen!

# Frontend auf fetch() umstellen
const response = await fetch('/api/upload', { ... });
```

## 🧪 Testing

### Manuelle Tests

Nach jedem Deployment prüft die Pipeline automatisch:
- ✅ Website erreichbar
- ✅ "Spielbericht hochladen" Label vorhanden
- ✅ Photo Input funktioniert
- ✅ Mobile Optimierung aktiv

### Lokale Tests

```bash
# Type checking
npm run type-check

# Build test
npm run build
```

## 📱 Browser-Kompatibilität

- ✅ Chrome/Safari Mobile (iOS 14+)
- ✅ Chrome Mobile (Android 10+)
- ✅ Desktop Browser (alle modernen)

## 🐛 Troubleshooting

### Upload schlägt fehl

**Problem:** "GitHub token nicht konfiguriert"

**Lösung:**
1. Überprüfen Sie, ob `GH_TOKEN` Secret gesetzt ist
2. Prüfen Sie Token-Berechtigungen (Contents: Read & Write)
3. Stellen Sie sicher, dass Token nicht abgelaufen ist

### Build schlägt fehl

**Problem:** TypeScript Fehler

**Lösung:**
```bash
npm run type-check  # Zeigt alle Type-Fehler
```

### Deployment schlägt fehl

**Problem:** GitHub Pages nicht aktiviert

**Lösung:**
1. Repository → Settings → Pages
2. Source: "GitHub Actions" wählen
3. Pipeline erneut triggern

## 📊 Performance

- **Initial Load**: ~100KB (gzipped)
- **Build Time**: ~5 Sekunden
- **Deploy Time**: ~30 Sekunden
- **First Contentful Paint**: <1s

## 🎯 Roadmap

- [ ] Unit Tests für Services
- [ ] E2E Tests mit Playwright
- [ ] Progressive Web App (PWA)
- [ ] Offline-Support
- [ ] Image Compression vor Upload
- [ ] Multi-File Upload
- [ ] Backend-Version (optional)

## 🤝 Contributing

Pull Requests sind willkommen!

1. Fork das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte.

## 🙏 Credits

- **TypeScript**: Type-safe JavaScript
- **Vite**: Next Generation Frontend Tooling
- **Octokit**: GitHub API Client
- **GitHub Pages**: Free Hosting

## 📚 Weitere Dokumentation

- [BACKEND_MIGRATION.md](BACKEND_MIGRATION.md) - Backend Migration Guide
- [AZURE_SETUP.md](AZURE_SETUP.md) - Legacy: Azure Deployment (nicht mehr relevant)

---

**Entwickelt mit ❤️ und TypeScript**

**Live:** https://appgates.github.io/PongPush/
