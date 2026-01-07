# 🏓 PongPush - Spielbericht Upload System

Eine mobile-optimierte ASP.NET Core Webanwendung zum Hochladen von Spielberichten (Fotos) direkt in ein GitHub Repository.

## 🌟 Features

- **Mobile-First Design**: Optimiert für Smartphone-Nutzung
- **Foto-Upload**: Direktes Aufnehmen oder Auswählen von Fotos vom Handy
- **GitHub Integration**: Automatisches Hochladen der Bilder ins Repository
- **CI/CD Pipeline**: Automatisches Deployment zu Azure bei jedem Push
- **Responsive UI**: Funktioniert auf allen Geräten
- **Validierung**: Dateiformat- und Größenprüfung (max. 10MB)

## 🚀 Technologie-Stack

- **Backend**: ASP.NET Core 8.0
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **API**: Octokit (GitHub API Client)
- **Hosting**: Azure App Service (Free Tier)
- **CI/CD**: GitHub Actions

## 📋 Voraussetzungen

- .NET 8.0 SDK
- GitHub Account
- Azure Account (kostenloser Free Tier ausreichend)

## 🔧 Setup-Anleitung

### 1. Azure Web App erstellen

1. Gehen Sie zum [Azure Portal](https://portal.azure.com)
2. Erstellen Sie eine neue **Web App**:
   - **Name**: `pongpush-app` (oder ein anderer Name)
   - **Runtime Stack**: .NET 8 (LTS)
   - **Operating System**: Linux
   - **Pricing Plan**: F1 (Free Tier)
3. Nach der Erstellung, gehen Sie zu **Deployment Center** > **Settings**
4. Laden Sie das **Publish Profile** herunter

### 2. GitHub Secrets konfigurieren

Fügen Sie folgende Secrets in GitHub hinzu (Settings > Secrets and variables > Actions):

1. **AZURE_WEBAPP_PUBLISH_PROFILE**
   - Inhalt: Der komplette Inhalt der heruntergeladenen `.publishsettings` Datei

2. **GITHUB_TOKEN** (für die Laufzeitumgebung)
   - Erstellen Sie ein Personal Access Token auf GitHub
   - Benötigte Berechtigungen: `repo` (Full control of private repositories)
   - Fügen Sie es als Secret hinzu

### 3. Azure App Settings konfigurieren

Gehen Sie in Azure zu Ihrer Web App > **Configuration** > **Application settings** und fügen Sie hinzu:

```
Name: GITHUB_TOKEN
Value: <Ihr GitHub Personal Access Token>
```

### 4. Lokale Entwicklung

```bash
# Repository klonen
git clone https://github.com/AppGates/PongPush.git
cd PongPush

# Umgebungsvariable setzen
export GITHUB_TOKEN="your_github_token_here"

# Dependencies wiederherstellen
dotnet restore

# Anwendung starten
dotnet run

# Browser öffnen
open http://localhost:5000
```

## 📁 Projektstruktur

```
PongPush/
├── Controllers/
│   └── UploadController.cs      # API Endpoint für Uploads
├── wwwroot/
│   ├── index.html                # Haupt-UI
│   ├── css/
│   │   └── style.css            # Styling
│   └── js/
│       └── app.js               # Frontend-Logik
├── .github/
│   └── workflows/
│       └── azure-deploy.yml     # CI/CD Pipeline
├── uploads/                      # Hochgeladene Bilder (Git-ignoriert lokal)
├── Program.cs                    # App-Konfiguration
├── PongPush.csproj              # Projekt-Datei
└── README.md                     # Diese Datei
```

## 🔄 CI/CD Pipeline

Die GitHub Actions Pipeline wird automatisch ausgelöst bei:

- **Push** auf `main` oder `claude/photo-upload-cicd-P9UDV` Branch
- **Pull Requests** zu `main`
- **Manueller Trigger** (workflow_dispatch)

### Pipeline-Schritte:

1. **Build**: Kompiliert die ASP.NET Core Anwendung
2. **Test**: Führt Tests aus (falls vorhanden)
3. **Publish**: Erstellt deploybare Artefakte
4. **Deploy**: Deployed zu Azure Web App
5. **Verify**: Überprüft, ob alle Features funktionieren

### Deployment-Verifikation

Die Pipeline prüft automatisch:
- ✅ Website-Erreichbarkeit
- ✅ Health-Endpoint Status
- ✅ "Spielbericht hochladen" Label vorhanden
- ✅ Photo-Input-Feld vorhanden
- ✅ Mobile-Viewport-Meta-Tag vorhanden

## 🎯 Verwendung

1. Öffnen Sie die Website auf Ihrem Smartphone: `https://pongpush-app.azurewebsites.net`
2. Tippen Sie auf "Spielbericht hochladen"
3. Machen Sie ein Foto oder wählen Sie ein bestehendes aus
4. Klicken Sie auf "Hochladen"
5. Das Foto wird automatisch in `uploads/` im Repository gespeichert

## 🔐 Sicherheit

- HTTPS-only Kommunikation
- Dateiformat-Validierung (nur Bilder)
- Dateigröße-Limitierung (10MB)
- GitHub Token sicher in Azure gespeichert
- Keine Credentials im Code

## 📱 Browser-Kompatibilität

- ✅ Chrome/Safari Mobile (iOS)
- ✅ Chrome Mobile (Android)
- ✅ Desktop-Browser (alle modernen)

## 🐛 Troubleshooting

### Upload schlägt fehl

- Überprüfen Sie, ob `GITHUB_TOKEN` in Azure konfiguriert ist
- Prüfen Sie die Token-Berechtigungen (muss `repo` access haben)
- Schauen Sie in die Azure App Service Logs

### Deployment schlägt fehl

- Überprüfen Sie `AZURE_WEBAPP_PUBLISH_PROFILE` Secret
- Stellen Sie sicher, dass der App Name in `azure-deploy.yml` korrekt ist
- Prüfen Sie GitHub Actions Logs für Details

### Health Check schlägt fehl

- Die App braucht ca. 30-60 Sekunden zum Starten
- Überprüfen Sie Azure App Service Status
- Schauen Sie in die Application Insights oder Logs

## 📄 Lizenz

MIT License - Frei verwendbar für private und kommerzielle Projekte.

## 👨‍💻 Entwickelt mit

- ASP.NET Core
- Octokit GitHub API
- GitHub Actions
- Azure App Service

---

**Hinweis**: Diese Anwendung wurde entwickelt, um Spielberichte einfach und mobil hochladen zu können.
