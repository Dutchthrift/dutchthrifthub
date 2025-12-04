# 🎯 Workflow Commando Overzicht

**Complete lijst van alle commando's voor de development workflow**

> [!IMPORTANT]
> **Vereenvoudigde Workflow:** De server blijft **ALTIJD op de `main` branch**. De `update/versie0.1` branch is ALLEEN voor lokale development en GitHub backup. Test lokaal op `localhost:5000`!
>
> 📖 **Voor snelle referentie:** Zie [`quick-start.md`](./quick-start.md)

---

## 1️⃣ Lokaal Werken (Op Je PC)

### Windows PowerShell Commando's

```powershell
# Navigeer naar project directory
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# Schakel naar update/versie0.1 branch
git checkout update/versie0.1

# Haal laatste wijzigingen van GitHub
git pull origin update/versie0.1

# Open project in VS Code
code .

# Start development server
npm run dev
```

**Open browser:** `http://localhost:5000`

### Na Wijzigingen

```powershell
# Bekijk wat er gewijzigd is
git status

# Voeg ALLE wijzigingen toe
git add .

# OF specifieke bestanden:
git add server/routes.ts
git add client/src/pages/Dashboard.tsx

# Commit met beschrijving
git commit -m "Feature: Nieuwe dashboard widget toegevoegd"

# Push naar GitHub (update/versie0.1 branch)
git push origin update/versie0.1
```

---

## 2️⃣ Testen (ALLEEN Lokaal!)

> [!NOTE]
> **Let op:** Je test ALLEEN lokaal op `http://localhost:5000`. De server blijft altijd op `main` branch en wordt NIET gebruikt voor testen met `update/versie0.1`.

**Lokaal testen:**
```powershell
# Start development server
npm run dev

# Open http://localhost:5000
# Test alle functionaliteit grondig!
```

**Test checklist:**
- ✅ Login werkt
- ✅ Nieuwe features werken
- ✅ Oude features werken nog
- ✅ Geen console errors (F12 → Console)
- ✅ Mobile responsive werkt
- ✅ Database queries werken (lokaal verbonden met live DB)

---

## 3️⃣ Database Migratie (Indien Schema Wijzigingen)

**Als je `db/schema.ts` hebt gewijzigd:**

```bash
# Op de server, na git pull
cd /var/www/dutchthrifthub

# Run database migratie
npm run db:push

# Dit past de database aan op basis van schema.ts

# Controleer of migratie succesvol was
sudo -u postgres psql -d dutchthrift
\dt  # Toon alle tabellen
\d table_name  # Toon structuur van specifieke tabel
\q  # Exit

# Rebuild & restart
npm run build
pm2 restart dutchthrift
```

---

## 4️⃣ Partner Review

### Informeer Partner

```
1. Stuur bericht naar partner over wijzigingen
2. Vraag om te testen op: https://hub.dutchthrift.com
3. Wacht op goedkeuring

✅ Goedgekeurd? → Ga verder naar stap 5
❌ Feedback? → Terug naar stap 1, maak aanpassingen
```

---

## 5️⃣ Merge naar Main (Productie)

### Methode 1: Via GitHub Pull Request (Aanbevolen)

**In browser:**

1. Ga naar: `https://github.com/Dutchthrift/dutchthrifthub`
2. Klik: **"Pull requests"** tab
3. Klik: **"New pull request"**
4. Stel in:
   - **Base:** `main`
   - **Compare:** `update/versie0.1`
5. Klik: **"Create pull request"**
6. Voeg beschrijving toe:
   ```
   ## Wijzigingen
   - Feature X toegevoegd
   - Bug Y opgelost
   - Database tabel Z toegevoegd
   
   ## Getest op update/versie0.1
   - [x] Alle features werken
   - [x] Geen errors
   - [x] Partner heeft goedgekeurd
   ```
7. Klik: **"Create pull request"**
8. Review de wijzigingen
9. Klik: **"Merge pull request"**
10. Klik: **"Confirm merge"**

**✅ Code is nu gemerged in main branch!**

### Methode 2: Lokaal Mergen

```powershell
# Op je PC
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# Schakel naar main
git checkout main

# Pull laatste main van GitHub
git pull origin main

# Merge update/versie0.1 in main
git merge update/versie0.1

# Los eventuele conflicts op (VS Code helpt hierbij)
# Conflicts? VS Code toont: "Accept Current" / "Accept Incoming"

# Push gemerge'd code naar GitHub
git push origin main
```

---

## 6️⃣ Deploy naar Productie (main branch op server)

### Verbind met Server

```powershell
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179
```

### Deploy Op Server

```bash
# Navigeer naar project
cd /var/www/dutchthrifthub

# Schakel naar main branch
git checkout main

# Pull de gemerge'd productie code
git pull origin main

# Installeer dependencies (indien package.json gewijzigd)
npm install

# Build productie versie
npm run build

# Restart applicatie
pm2 restart dutchthrift

# Check status
pm2 status

# Bekijk logs
pm2 logs dutchthrift --lines 30

# Real-time logs (Ctrl+C om te stoppen)
pm2 logs dutchthrift
```

### Verificatie

**✅ Test live website:** `https://hub.dutchthrift.com`

**Post-deployment checklist:**
- [ ] Website bereikbaar
- [ ] Login werkt
- [ ] Nieuwe features zijn live
- [ ] Geen errors in logs
- [ ] Database data is intact

---

## 🔧 Handy Extra Commando's

### Git Commando's

```powershell
# Check huidige branch
git branch

# Wissel van branch
git checkout update/versie0.1
git checkout main

# Bekijk laatste commits
git log --oneline -10

# Bekijk verschillen tussen branches
git diff main update/versie0.1

# Annuleer laatste commit (lokaal, niet gepusht)
git reset --soft HEAD~1

# Verwijder lokale wijzigingen (⚠️ permanent!)
git checkout -- .
```

### Server PM2 Commando's

```bash
# Status van alle PM2 processen
pm2 status

# Logs van specifieke app
pm2 logs dutchthrift

# Stop applicatie
pm2 stop dutchthrift

# Start applicatie
pm2 start dutchthrift

# Restart applicatie
pm2 restart dutchthrift

# Delete applicatie van PM2
pm2 delete dutchthrift

# Start nieuw (als je PM2 config wijzigt)
pm2 start npm --name "dutchthrift" -- start
pm2 save

# Monitor (real-time CPU/Memory)
pm2 monit

# Flush alle logs
pm2 flush
```

### Server System Commando's

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check welke processen draaien op poort 5000
sudo lsof -i :5000

# Check database status
sudo systemctl status postgresql

# Restart PostgreSQL  (⚠️ voorzichtig!)
sudo systemctl restart postgresql

# Check Apache status
sudo systemctl status apache2

# Restart Apache
sudo systemctl restart apache2
```

### Database Commando's

```bash
# Open PostgreSQL
sudo -u postgres psql -d dutchthrift

# In psql:
\dt                    # Toon alle tabellen
\d users               # Toon structuur van 'users' tabel
\l                     # Toon alle databases
\du                    # Toon alle users

SELECT COUNT(*) FROM users;    # Tel records
SELECT * FROM users LIMIT 5;   # Toon eerste 5 records

\q  # Exit
```

---

## 📊 Snelle Referentie

### Dagelijkse Workflow

```powershell
# 1. LOKAAL (PC)
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"
git checkout update/versie0.1
git pull origin update/versie0.1
# ... maak wijzigingen ...
npm run dev  # Test
git add .
git commit -m "Feature: Beschrijving"
git push origin update/versie0.1

# 2. SERVER (Test)
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179
cd /var/www/dutchthrifthub
git checkout update/versie0.1
git pull origin update/versie0.1
npm install
npm run build
pm2 restart dutchthrift
pm2 logs dutchthrift

# 3. TEST & PARTNER REVIEW
# Test https://hub.dutchthrift.com
# Wacht op partner goedkeuring

# 4. MERGE (GitHub)
# Create Pull Request: update/versie0.1 → main
# Merge PR

# 5. PRODUCTIE DEPLOY (Server)
cd /var/www/dutchthrifthub
git checkout main
git pull origin main
npm install
npm run build
pm2 restart dutchthrift
pm2 logs dutchthrift

# ✅ LIVE!
```

---

## 🆘 Emergency Commando's

### Website Down?

```bash
# Check status
pm2 status

# Check logs
pm2 logs dutchthrift --lines 100

# Restart
pm2 restart dutchthrift

# Als het niet helpt:
pm2 stop dutchthrift
pm2 start dutchthrift

# Rebuild from scratch
cd /var/www/dutchthrifthub
npm run build
pm2 restart dutchthrift
```

### Database Connection Error?

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check .env bestand
cat /var/www/dutchthrifthub/.env | grep DATABASE_URL

# Test database verbinding
psql -U dutchthrift_user -d dutchthrift -h localhost
```

### Rollback naar Vorige Versie

```bash
# Op server
cd /var/www/dutchthrifthub

# Bekijk laatste commits
git log --oneline -10

# Ga terug naar specifieke commit
git checkout <commit-hash>

# OF: ga terug 1 commit
git reset --hard HEAD~1

# Rebuild & restart
npm run build
pm2 restart dutchthrift
```

---

**🎉 Succes met deployen!**

_Voor vragen: zie hoofddocumentatie in `docs/update-werkwijze.md`_


