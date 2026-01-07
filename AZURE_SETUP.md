# 🚀 Azure Setup Quick-Start Guide

Diese Anleitung führt Sie Schritt für Schritt durch die Einrichtung von Azure App Service und die Konfiguration der GitHub Actions Pipeline.

## 📋 Übersicht

1. Azure Web App erstellen (5 Minuten)
2. GitHub Secrets konfigurieren (3 Minuten)
3. Azure App Settings einrichten (2 Minuten)
4. Pipeline testen (1 Minute)

## 1️⃣ Azure Web App erstellen

### Option A: Über Azure Portal (GUI)

1. **Azure Portal öffnen**: [https://portal.azure.com](https://portal.azure.com)

2. **Neue Ressource erstellen**:
   - Klicken Sie auf "+ Create a resource"
   - Suchen Sie nach "Web App"
   - Klicken Sie auf "Create"

3. **Konfiguration**:

   **Basics Tab:**
   - **Subscription**: Wählen Sie Ihre Subscription
   - **Resource Group**: Erstellen Sie eine neue oder wählen Sie eine existierende (z.B. "pongpush-rg")
   - **Name**: `pongpush-app` (muss global eindeutig sein, ggf. Suffix hinzufügen)
   - **Publish**: `Code`
   - **Runtime stack**: `.NET 8 (LTS)`
   - **Operating System**: `Linux`
   - **Region**: Wählen Sie eine Region in Ihrer Nähe (z.B. "West Europe")

   **Pricing Tab:**
   - **Pricing plan**: Klicken Sie auf "Explore pricing plans"
   - Wählen Sie **"Free F1"** (1 GB RAM, 60 CPU minutes/day)
   - Klicken Sie auf "Select"

4. **Review + Create**:
   - Überprüfen Sie die Einstellungen
   - Klicken Sie auf "Create"
   - Warten Sie ~1-2 Minuten auf die Deployment-Fertigstellung

### Option B: Über Azure CLI (Kommandozeile)

```bash
# Login
az login

# Resource Group erstellen
az group create --name pongpush-rg --location westeurope

# App Service Plan erstellen (Free Tier)
az appservice plan create \
  --name pongpush-plan \
  --resource-group pongpush-rg \
  --sku F1 \
  --is-linux

# Web App erstellen
az webapp create \
  --name pongpush-app \
  --resource-group pongpush-rg \
  --plan pongpush-plan \
  --runtime "DOTNETCORE:8.0"
```

## 2️⃣ Publish Profile herunterladen

1. **Zu Ihrer Web App navigieren**:
   - Im Azure Portal, gehen Sie zu "All resources"
   - Klicken Sie auf Ihre Web App (`pongpush-app`)

2. **Publish Profile herunterladen**:
   - Klicken Sie in der Top-Menüleiste auf **"Get publish profile"**
   - Eine `.PublishSettings` Datei wird heruntergeladen
   - **WICHTIG**: Diese Datei enthält sensible Daten, sicher aufbewahren!

## 3️⃣ GitHub Secrets konfigurieren

1. **Zu GitHub Repository gehen**:
   - Öffnen Sie [https://github.com/AppGates/PongPush](https://github.com/AppGates/PongPush)

2. **Settings öffnen**:
   - Klicken Sie auf "Settings" (oben rechts im Repository)
   - Im linken Menü: "Secrets and variables" > "Actions"

3. **Secrets hinzufügen**:

   **Secret 1: AZURE_WEBAPP_PUBLISH_PROFILE**
   - Klicken Sie auf "New repository secret"
   - **Name**: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - **Value**: Öffnen Sie die heruntergeladene `.PublishSettings` Datei mit einem Texteditor und kopieren Sie den **kompletten Inhalt**
   - Klicken Sie auf "Add secret"

   **Secret 2: GITHUB_TOKEN (Personal Access Token)**
   - Gehen Sie zu [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
   - Klicken Sie auf "Generate new token (classic)"
   - **Note**: "PongPush Upload Token"
   - **Expiration**: Wählen Sie eine Gültigkeit (z.B. 90 days oder No expiration)
   - **Scopes**: Wählen Sie `repo` (Full control of private repositories)
   - Klicken Sie auf "Generate token"
   - **WICHTIG**: Kopieren Sie das Token sofort, es wird nur einmal angezeigt!
   - Zurück zu Repository Settings > Secrets and variables > Actions
   - Klicken Sie auf "New repository secret"
   - **Name**: Aktuell nicht benötigt als Secret (wird später als Environment Variable gesetzt)
   - Merken Sie sich das Token für den nächsten Schritt!

## 4️⃣ Azure App Settings konfigurieren

Die Web App benötigt das GitHub Token als Umgebungsvariable für die API-Calls.

### Option A: Über Azure Portal

1. **Zu Ihrer Web App navigieren**:
   - Azure Portal > Ihre Web App (`pongpush-app`)

2. **Configuration öffnen**:
   - Im linken Menü unter "Settings" > "Configuration"
   - Tab "Application settings"

3. **Neue Setting hinzufügen**:
   - Klicken Sie auf "+ New application setting"
   - **Name**: `GITHUB_TOKEN`
   - **Value**: Ihr Personal Access Token (aus Schritt 3)
   - Klicken Sie auf "OK"
   - **WICHTIG**: Klicken Sie oben auf "Save" und bestätigen Sie

### Option B: Über Azure CLI

```bash
az webapp config appsettings set \
  --name pongpush-app \
  --resource-group pongpush-rg \
  --settings GITHUB_TOKEN="ghp_your_token_here"
```

## 5️⃣ Deployment testen

### Automatischer Trigger

1. **Prüfen Sie GitHub Actions**:
   - Gehen Sie zu Ihrem Repository auf GitHub
   - Klicken Sie auf den "Actions" Tab
   - Sie sollten einen laufenden oder abgeschlossenen Workflow sehen: "Build and Deploy to Azure"

2. **Workflow manuell starten** (falls nötig):
   - Im "Actions" Tab
   - Wählen Sie "Build and Deploy to Azure" im linken Menü
   - Klicken Sie auf "Run workflow" > "Run workflow"

3. **Workflow-Status überprüfen**:
   - Klicken Sie auf den laufenden Workflow
   - Beobachten Sie die Jobs: `build`, `deploy`, `verify-deployment`
   - Alle sollten grüne Häkchen bekommen ✅

### Website testen

1. **URL öffnen**:
   ```
   https://pongpush-app.azurewebsites.net
   ```

2. **Funktionalität prüfen**:
   - ✅ Die Seite lädt (kann beim ersten Mal ~30 Sekunden dauern)
   - ✅ "Spielbericht hochladen" Label ist sichtbar
   - ✅ File-Input funktioniert
   - ✅ Upload-Button ist vorhanden

3. **Upload testen**:
   - Wählen Sie ein Testbild aus
   - Klicken Sie auf "Hochladen"
   - Nach erfolgreichem Upload sollte eine Erfolgsmeldung erscheinen
   - Das Bild sollte im `uploads/` Ordner des Repositories erscheinen

## 🔍 Troubleshooting

### Problem: Deployment schlägt fehl

**Lösung**:
1. Überprüfen Sie GitHub Actions Logs für Details
2. Stellen Sie sicher, dass `AZURE_WEBAPP_PUBLISH_PROFILE` korrekt kopiert wurde (inklusive XML-Tags)
3. Prüfen Sie, ob der App Name in `.github/workflows/azure-deploy.yml` mit Ihrer Azure Web App übereinstimmt

### Problem: Website lädt nicht

**Lösung**:
1. Geben Sie der App 30-60 Sekunden zum Starten (Cold Start)
2. Überprüfen Sie Azure Portal > Web App > "Log stream" für Fehler
3. Prüfen Sie, ob die Web App läuft: Azure Portal > Web App > "Overview" (Status sollte "Running" sein)

### Problem: Upload schlägt fehl mit "Server-Konfigurationsfehler"

**Lösung**:
1. Überprüfen Sie, ob `GITHUB_TOKEN` in Azure App Settings konfiguriert ist
2. Stellen Sie sicher, dass das Token die richtigen Berechtigungen hat (`repo` scope)
3. Prüfen Sie, ob das Token noch gültig ist (nicht abgelaufen)

### Problem: Bilder werden nicht ins Repository hochgeladen

**Lösung**:
1. Überprüfen Sie die Browser-Console für JavaScript-Fehler
2. Testen Sie den Health-Endpoint: `https://pongpush-app.azurewebsites.net/api/upload/health`
3. Sollte `hasGitHubToken: true` zurückgeben
4. Überprüfen Sie Azure Application Insights oder Logs für Backend-Fehler

### Problem: Verify-Deployment Job schlägt fehl

**Lösung**:
1. Das ist nicht kritisch - die Deployment ist trotzdem erfolgreich
2. Der Job prüft nur, ob alle Features vorhanden sind
3. Überprüfen Sie den Job-Log, um zu sehen, welcher Test fehlschlägt
4. Die meisten Fehler sind zeitliche Probleme (App noch nicht vollständig gestartet)

## 📊 App Name anpassen

Wenn `pongpush-app` bereits vergeben ist, müssen Sie den Namen ändern:

1. **In Azure**: Verwenden Sie einen anderen Namen (z.B. `pongpush-app-2026`)

2. **In `.github/workflows/azure-deploy.yml`**: Ändern Sie:
   ```yaml
   env:
     AZURE_WEBAPP_NAME: pongpush-app-2026  # Ihr neuer Name
   ```

3. **Commit und Push**: Damit die Pipeline den neuen Namen verwendet

## ✅ Erfolgskriterien

Nach erfolgreichem Setup sollten Sie haben:

- ✅ Azure Web App läuft (Free Tier)
- ✅ GitHub Actions Pipeline läuft durch (alle grün)
- ✅ Website ist erreichbar unter `https://<ihr-app-name>.azurewebsites.net`
- ✅ Upload-Funktionalität funktioniert
- ✅ Bilder erscheinen im `uploads/` Ordner des Repositories
- ✅ Automatisches Deployment bei jedem Push

## 🎉 Fertig!

Ihre PongPush App ist jetzt live und bereit, Spielberichte zu empfangen!

Bei jedem Push zum Repository wird die App automatisch neu deployed.

---

**Hilfe benötigt?** Schauen Sie in die [README.md](README.md) für weitere Details oder erstellen Sie ein Issue im Repository.
