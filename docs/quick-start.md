# ⚡ Quick Start - Development naar Live

**Snelle referentie voor dagelijkse development workflow**

---

## 🎯 Workflow Overzicht

```
💻 Lokaal ontwikkelen (update/versie0.1)
    ↓ Test op localhost:5000
📤 Push naar GitHub (backup)
    ↓ Verzamelen updates in update/versie0.1
✅ Tevreden met alle updates?
    ↓ Merge naar main branch
🔴 Deploy naar server (server ALTIJD op main)
    ↓
✅ LIVE op https://hub.dutchthrift.com
```

**Belangrijkste regel:** 
- 🟡 `update/versie0.1` = Alleen lokaal testen
- 🔴 `main` = Server (productie)

---

## 🚀 Dagelijkse Workflow

### Stap 1: Lokaal Ontwikkelen & Testen

```powershell
# Open PowerShell, navigeer naar project
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# Schakel naar development branch
git checkout update/versie0.1

# Haal laatste wijzigingen op (van GitHub)
git pull origin update/versie0.1

# ⚠️ NA GROTE UPDATES: Installeer nieuwe/gewijzigde packages
npm install

# Open in VS Code
code .

# Start development server
npm run dev
```

**Open browser:** `http://localhost:5000`

**Maak wijzigingen, test grondig!**

---

### Stap 2: Push naar GitHub (Backup)

```powershell
# ⚠️ CHECK EERST WELKE BRANCH JE OP ZIT!
git branch
# Moet tonen: * update/versie0.1
# Als je op main zit, schakel eerst: git checkout update/versie0.1

# Check wat er gewijzigd is
git status

# Voeg alle wijzigingen toe
git add .

# Commit met beschrijving
git commit -m "Feature: Beschrijving van je wijziging"

# Push naar GitHub (update/versie0.1 branch)
git push origin update/versie0.1
```

> ⚠️ **LET OP:** Push NOOIT direct naar `main`! Altijd naar `update/versie0.1` pushen en later mergen.

✅ **Code staat nu veilig op GitHub!**

**Je kan dit herhalen zoveel je wilt - blijf testen en pushen tot alles perfect is.**

---

### Stap 3: Merge naar Main (Als Alles Klaar Is)

**Optie A: Via GitHub Pull Request** (Aanbevolen voor partner review)

```
1. Open: https://github.com/Dutchthrift/dutchthrifthub
2. Klik "Pull requests" → "New pull request"
3. Base: main, Compare: update/versie0.1
4. Klik "Create pull request"
5. Voeg beschrijving toe van alle wijzigingen
6. (Optioneel) Vraag partner om review
7. Klik "Merge pull request"
8. Klik "Confirm merge"
```

**Optie B: Lokaal Mergen**

```powershell
# Schakel naar main
git checkout main

# Pull laatste main
git pull origin main

# Merge update/versie0.1 in main
git merge update/versie0.1

# Push naar GitHub
git push origin main
```

✅ **Main branch heeft nu alle updates!**

---

### Stap 4: Deploy naar Live Server

```powershell
# Verbind met server
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179
```

```bash
# Nu op de server:
cd /var/www/dutchthrifthub

# Check dat je op main staat (server blijft ALTIJD op main!)
git branch
# Moet tonen: * main

# Pull de nieuwe code
git pull origin main

# Installeer nieuwe packages (indien package.json gewijzigd)
npm install

# Build productie versie
npm run build

# Restart applicatie
pm2 restart dutchthrift

# Check logs
pm2 logs dutchthrift --lines 30
```

**✅ Test live site:** `https://hub.dutchthrift.com`

---

## 📋 Snelle Command Lijst

### Lokaal Ontwikkelen

```powershell
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"
git checkout update/versie0.1
git pull origin update/versie0.1
npm install               # Na grote updates
npm run dev               # Test op localhost:5000
```

### Push Updates

```powershell
git add .
git commit -m "Feature: Beschrijving"
git push origin update/versie0.1
```

### Merge naar Main

```powershell
git checkout main
git pull origin main
git merge update/versie0.1
git push origin main
```

### Deploy Live

```bash
# Op server (via SSH)
cd /var/www/dutchthrifthub
git pull origin main
npm install
npm run build
pm2 restart dutchthrift
```

---

## 🗄️ Database Migraties

**Als je `db/schema.ts` hebt gewijzigd (nieuwe tabel/kolom):**

```powershell
# 1. Test lokaal eerst
npm run dev  # Drizzle past lokale database aan

# 2. Push naar GitHub
git add db/schema.ts
git commit -m "Database: Nieuwe tabel X toegevoegd"
git push origin update/versie0.1

# 3. Merge naar main (zoals normaal)
git checkout main
git merge update/versie0.1
git push origin main
```

```bash
# 4. Op server: Run migratie
cd /var/www/dutchthrifthub
git pull origin main

# RUN DATABASE MIGRATIE
npm run db:push

# Dit past de database schema aan!

# Build & restart
npm run build
pm2 restart dutchthrift
```

---

## 💾 Database Backup

### Backup Maken (op server via SSH)

```bash
# Verbind met server
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179

# Maak backup
cd /var/www/dutchthrifthub
pg_dump -U dutchthrift_user -d dutchthrift -h localhost > backup_$(date +%Y%m%d_%H%M%S).sql

# Of met compressie (kleiner bestand)
pg_dump -U dutchthrift_user -d dutchthrift -h localhost | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Backup Downloaden naar PC

```powershell
# In PowerShell op je PC
scp -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179:/var/www/dutchthrifthub/backup_*.sql "C:\Users\Niek Oenema\Documents\backups\"
```

### Backup Terugzetten

```bash
# Op server (alleen bij noodgevallen!)
psql -U dutchthrift_user -d dutchthrift -h localhost < backup_20241218_123456.sql
```

> ⚠️ **TIP:** Maak ALTIJD een backup voordat je schema wijzigingen doet via `npm run db:push`!

---

## ⚠️ Belangrijke Regels

✅ **Server staat ALTIJD op `main` branch**
- De live website draait ALLEEN vanaf `main`
- Nooit `update/versie0.1` deployen naar server voor testen

✅ **Lokaal testen op `localhost:5000`**
- Test ALLES lokaal voordat je naar main merged
- Gebruik `update/versie0.1` voor development

✅ **GitHub `update/versie0.1` = Backup**
- Push regelmatig naar GitHub (meerdere keren per dag OK)
- Verzamel updates tot je tevreden bent
- Dan pas merge naar `main`

✅ **Main = Productie**
- Merge alleen naar `main` als alles 100% werkt
- Direct na merge naar main → deploy naar server

---

## 🆘 Problemen?

### Website werkt niet na deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs dutchthrift --lines 50

# Restart
pm2 restart dutchthrift

# Rebuild
cd /var/www/dutchthrifthub
npm run build
pm2 restart dutchthrift
```

### Database errors na migratie

```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Test database verbinding
psql -U dutchthrift_user -d dutchthrift -h localhost
\dt  # Toon tabellen
\q

# Herrun migratie
npm run db:push
```

### Merge conflicts

```powershell
# Bij merge conflict in VS Code:
# 1. VS Code toont conflict visueel
# 2. Kies: "Accept Current" of "Accept Incoming"
# 3. Save file
git add .
git commit -m "Merge: Resolved conflicts"
git push origin main
```

---

## 🔄 Complete Cyclus Voorbeeld

**Voorbeeld: Nieuwe Dashboard Widget Toevoegen**

```powershell
# === DAG 1: Start Development ===
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"
git checkout update/versie0.1
git pull origin update/versie0.1

# Wijzig: client/src/pages/Dashboard.tsx
# Test lokaal: npm run dev

git add client/src/pages/Dashboard.tsx
git commit -m "Feature: Dashboard widget toegevoegd (WIP)"
git push origin update/versie0.1

# === DAG 2: Verder werken ===
# Meer wijzigingen...
git add .
git commit -m "Feature: Dashboard widget styling af"
git push origin update/versie0.1

# === DAG 3: Klaar voor live ===
# Laatste test lokaal
npm run dev
# Alles werkt! ✅

# Merge naar main
git checkout main
git pull origin main
git merge update/versie0.1
git push origin main

# Deploy naar server
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179
cd /var/www/dutchthrifthub
git pull origin main
npm install
npm run build
pm2 restart dutchthrift

# ✅ LIVE!
```

---

## 📚 Meer Info?

- **Volledige uitleg:** `docs/update-werkwijze.md`
- **Alle commando's:** `docs/workflow-commando-overzicht.md`
- **Dit document:** Voor dagelijkse quick reference

---

**🎉 Succes met ontwikkelen!**
