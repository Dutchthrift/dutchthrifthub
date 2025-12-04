# 🔄 DutchThrift Hub - Update & Deployment Werkwijze

**Laatste update:** 4 December 2024  
**Versie:** 1.1

> [!IMPORTANT]
> **Vereenvoudigde Workflow:** De server blijft **ALTIJD op de `main` branch**. De `update/versie0.1` branch wordt ALLEEN gebruikt voor lokale development en als backup op GitHub. Test lokaal op `localhost:5000`, niet op de live server!
>
> 📖 **Voor dagelijks gebruik:** Zie [`quick-start.md`](./quick-start.md) voor een beknopte command referentie.

---

## � Quick Start: Complete Workflow

**Van Ontwikkeling naar Productie in 6 Stappen:**

```
1. 💻 Lokaal werken op update/versie0.1
   ├─ git checkout update/versie0.1
   ├─ Wijzigingen maken
   └─ git push origin update/versie0.1
   
2. 🟡 Test op server (update/versie0.1)
   ├─ git pull origin update/versie0.1
   ├─ npm run build
   └─ pm2 restart dutchthrift
   
3. ✅ Test & valideer
   └─ Test alle functionaliteit
   
4. 👥 Partner review
   ├─ Partner test features
   └─ Goedkeuring? → Ga verder
   
5. 🔄 Merge naar main
   ├─ Pull Request op GitHub
   └─ Merge update/versie0.1 → main
   
6. 🔴 Deploy productie
   ├─ git pull origin main
   ├─ npm run build
   └─ pm2 restart dutchthrift
   
✅ LIVE op https://hub.dutchthrift.com
```

---

## �📋 Inhoudsopgave

1. [Projectstructuur](#projectstructuur)
2. [Overzicht Branches](#overzicht-branches)
3. [Repository & Server Setup](#repository--server-setup)
4. [Development Workflow](#development-workflow)
5. [Testen op update/versie0.1 Branch](#testen-op-versie01-branch)
6. [Deployen naar Production (main)](#deployen-naar-production-main)
7. [Database Migraties](#database-migraties)
8. [Troubleshooting](#troubleshooting)

---

## 📁 Projectstructuur

### Waar Staat Alles?

**Lokaal (PC):**
```
d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub\
```

**Server:**
```
/var/www/dutchthrifthub/
```

### 🗂️ Hoofdmappen Overzicht

```
dutchthrifthub/
├── 📂 client/              # Frontend (React, UI componenten)
│   └── src/
│       ├── components/     # React componenten (buttons, modals, etc.)
│       ├── pages/          # Pagina's (Dashboard, Orders, Customers, etc.)
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility functies
│       └── App.tsx         # Hoofdapplicatie
│
├── 📂 server/              # Backend (Express, API routes)
│   ├── routes.ts           # 🔥 HOOFD API BESTAND (alle endpoints)
│   ├── storage.ts          # Google Cloud Storage (file uploads)
│   ├── services/           # Business logic (Shopify, email sync, etc.)
│   └── index.ts            # Server start file
│
├── 📂 db/                  # Database
│   └── schema.ts           # 🔥 DATABASE SCHEMA (tabellen definitie)
│
├── 📂 shared/              # Gedeelde code tussen client & server
│   └── types.ts            # TypeScript types
│
├── 📂 docs/                # Documentatie
│   ├── update-werkwijze.md # Deze handleiding
│   └── git-github-handleiding.md
│
├── 📂 dist/                # Gebouwde productie bestanden (na npm run build)
│
├── 📂 node_modules/        # Dependencies (niet in Git)
│
├── 📄 .env                 # 🔒 Environment variabelen (DATABASE_URL, API keys)
├── 📄 package.json         # Dependencies & scripts
├── 📄 vite.config.ts       # Vite bundler configuratie
├── 📄 tsconfig.json        # TypeScript configuratie
└── 📄 tailwind.config.ts   # Tailwind CSS configuratie
```

---

## 📂 Gedetailleerde Mappenstructuur

### 1️⃣ Frontend: `client/src/`

**Locatie:** `client/src/`

| Map/Bestand | Functie | Voorbeelden |
|-------------|---------|-------------|
| **`components/`** | Herbruikbare UI componenten | Buttons, Modals, Tables, Forms |
| **`pages/`** | Volledige pagina's | Dashboard.tsx, Orders.tsx, Customers.tsx |
| **`hooks/`** | Custom React hooks | useUser.ts, useToast.ts |
| **`lib/`** | Utility functies | API calls, formatters, helpers |
| **`App.tsx`** | Hoofdcomponent | Routing, layout, authentication |
| **`index.css`** | Globale CSS | Tailwind imports, custom styles |
| **`main.tsx`** | Entry point | React DOM render |

#### Belangrijkste Componenten

```
client/src/components/
├── ui/                    # Basis UI componenten (shadcn/ui)
│   ├── button.tsx         # Button component
│   ├── dialog.tsx         # Modal/Dialog
│   ├── table.tsx          # Tabel component
│   └── form.tsx           # Form elementen
│
├── Dashboard/             # Dashboard specifieke componenten
├── OrdersList.tsx         # Orders lijst
├── CustomerList.tsx       # Klanten lijst
└── Header.tsx             # App header/navigation
```

#### Belangrijkste Pagina's

```
client/src/pages/
├── Dashboard.tsx          # Homepage (statistieken, grafieken)
├── Orders.tsx             # Bestellingen overzicht
├── Customers.tsx          # Klanten beheer
├── Returns.tsx            # Retourzendingen
├── Suppliers.tsx          # Leveranciers
├── Cases.tsx              # Support cases
└── Login.tsx              # Login pagina
```

**Waar voor?**
- **Nieuwe pagina toevoegen:** Maak nieuw bestand in `pages/`
- **UI component wijzigen:** Edit in `components/`
- **Styling aanpassen:** Wijzig `index.css` of component-specifieke styling

---

### 2️⃣ Backend: `server/`

**Locatie:** `server/`

| Bestand | Functie | Grootte | Prioriteit |
|---------|---------|---------|-----------|
| **`routes.ts`** | 🔥 **HOOFD API BESTAND** - Alle endpoints | 226 KB | ⭐⭐⭐ |
| **`storage.ts`** | Google Cloud Storage (PDF uploads, etc.) | 72 KB | ⭐⭐ |
| **`index.ts`** | Server startup, Express configuratie | 3 KB | ⭐⭐⭐ |
| **`services/`** | Business logic (Shopify sync, email, etc.) | - | ⭐⭐ |

#### `routes.ts` - Hoofd API Bestand

**Dit bestand bevat ALLE API endpoints!** Onthoudoneel.

**Belangrijkste endpoints:**
```typescript
// Authenticatie
POST /api/login              // Login
POST /api/logout             // Logout
GET  /api/user               // Huidige gebruiker

// Klanten
GET    /api/customers        // Alle klanten
POST   /api/customers        // Nieuwe klant
PUT    /api/customers/:id    // Update klant
DELETE /api/customers/:id    // Verwijder klant

// Orders
GET    /api/orders           // Alle orders
GET    /api/orders/:id       // Specifieke order
POST   /api/orders           // Nieuwe order
PUT    /api/orders/:id       // Update order

// Retourzendingen
GET    /api/returns          // Alle returns
POST   /api/returns          // Nieuwe return
PUT    /api/returns/:id      // Update return

// Leveranciers
GET    /api/suppliers        // Alle leveranciers
POST   /api/suppliers        // Nieuwe leverancier

// Cases (Support tickets)
GET    /api/cases            // Alle cases
POST   /api/cases            // Nieuwe case
PUT    /api/cases/:id        // Update case

// Notities
GET    /api/notes/customer/:customerId  // Klant notities
POST   /api/notes                       // Nieuwe notitie
DELETE /api/notes/:id                   // Verwijder notitie

// Emails
GET    /api/emails           // Alle emails
POST   /api/emails/sync      // Sync emails van server

// Statistieken
GET    /api/dashboard/stats  // Dashboard statistieken
```

**Waar voor?**
- **Nieuwe API endpoint toevoegen:** Edit `server/routes.ts`
- **Bestaande API logica wijzigen:** Edit `server/routes.ts`
- **Database queries wijzigen:** Edit `server/routes.ts` (gebruikt Drizzle ORM)

#### `services/` - Business Logic

```
server/services/
├── shopifyService.ts      # Shopify API sync (orders, products)
├── emailService.ts        # Email sync (IMAP)
├── notificationService.ts # Notifications (toekomstig)
└── webhookService.ts      # Shopify webhooks
```

---

### 3️⃣ Database: `db/`

**Locatie:** `db/schema.ts`

**Dit is het ENIGE bestand voor database schema definitie!**

#### Huidige Tabellen (25+)

```typescript
// Belangrijkste tabellen:
- users                // Gebruikers accounts
- customers            // Klanten (2,619 records)
- orders               // Bestellingen (2,705 records)
- order_line_items     // Order regels
- returns              // Retourzendingen
- return_line_items    // Return regels
- suppliers            // Leveranciers (601 records)
- purchase_orders      // Inkoop orders
- cases                // Support cases
- notes                // Notities (klanten, orders, etc.)
- emails               // Email archief (2,000 records)
- products             // Producten
- product_variants     // Product varianten
- todos                // Todo lijst
```

**Voorbeeld schema definitie:**

```typescript
// db/schema.ts
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  shopifyId: text("shopify_id").unique(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }),
  ordersCount: integer("orders_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  shopifyId: text("shopify_id").unique(),
  orderNumber: text("order_number"),
  customerId: integer("customer_id").references(() => customers.id),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }),
  status: text("status"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Waar voor?**
- **Nieuwe tabel toevoegen:** Edit `db/schema.ts`, voeg nieuwe `pgTable()` toe
- **Kolom toevoegen aan tabel:** Edit `db/schema.ts`, voeg property toe aan tabel
- **Database migreren:** Run `npm run db:push` (zie [Database Migraties](#database-migraties))

---

### 4️⃣ Configuratie Bestanden

**Root directory** - Belangrijkste config bestanden

| Bestand | Functie | Wanneer Wijzigen? |
|---------|---------|-------------------|
| **`.env`** | 🔒 Environment variabelen (DATABASE_URL, API keys) | Bij nieuwe API keys, database URL wijzigen |
| **`package.json`** | Dependencies & NPM scripts | Nieuwe packages installeren |
| **`vite.config.ts`** | Vite bundler (dev server, build) | Proxy settings, build optimalisatie |
| **`tsconfig.json`** | TypeScript compilatie settings | Type checking aanpassen |
| **`tailwind.config.ts`** | Tailwind CSS configuratie | Custom colors, fonts, breakpoints |
| **`drizzle.config.ts`** | Database migratie configuratie | Database connection wijzigen |

#### `.env` - Environment Variabelen

**⚠️ BELANGRIJK:** Dit bestand staat NIET in Git (security)!

```bash
# Database
DATABASE_URL=postgresql://dutchthrift_user:PASSWORD@localhost:5432/dutchthrift

# Session
SESSION_SECRET=your-secret-key-here

# Shopify
SHOPIFY_SHOP_DOMAIN=dutchthrift.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_BUCKET_NAME=dutchthrift-uploads
GOOGLE_CLOUD_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n

# Email (IMAP)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASSWORD=your-app-password
```

**Locatie op server:** `/var/www/dutchthrifthub/.env`

#### `package.json` - NPM Scripts

**Belangrijkste commands:**

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts...",
    "start": "cross-env NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  }
}
```

**Gebruik:**
```bash
npm run dev      # Start development server (localhost:5000)
npm run build    # Build voor productie (maakt dist/ folder)
npm start        # Start productie server (gebruikt dist/)
npm run db:push  # Database migratie
```

---

## 🎯 Waar Moet Ik Zijn Voor...?

### Nieuwe Feature Toevoegen

| Task | Bestand(en) |
|------|-------------|
| **Nieuwe pagina** | `client/src/pages/NewPage.tsx` + routing in `App.tsx` |
| **Nieuwe UI component** | `client/src/components/NewComponent.tsx` |
| **Nieuwe API endpoint** | `server/routes.ts` (voeg route toe) |
| **Nieuwe database tabel** | `db/schema.ts` (voeg `pgTable` toe) |

### Bestaande Functionaliteit Wijzigen

| Wat Wijzigen | Waar |
|--------------|------|
| **Dashboard statistieken** | `client/src/pages/Dashboard.tsx` + `server/routes.ts` (`/api/dashboard/stats`) |
| **Orders lijst** | `client/src/pages/Orders.tsx` |
| **Login logica** | `server/routes.ts` (`/api/login`) |
| **Database query** | `server/routes.ts` (zoek naar tabel naam) |
| **Email sync** | `server/services/emailService.ts` |
| **Shopify sync** | `server/services/shopifyService.ts` |

### Styling & Design

| Wat | Waar |
|-----|------|
| **Global colors/fonts** | `client/src/index.css` |
| **Tailwind custom colors** | `tailwind.config.ts` |
| **Component styling** | Component zelf (Tailwind classes) |

### Bug Fixing

1. **Check browser console:**
   - F12 → Console tab
   - Zie je errors? → Vaak component naam in error → ga naar dat bestand

2. **Check server logs:**
   ```bash
   pm2 logs dutchthrift --lines 50
   ```
   - Zie je error? → Vaak bestandsnaam + regel nummer → ga naar die regel

3. **Database errors:**
   - Check `server/routes.ts` voor SQL query
   - Check `db/schema.ts` voor tabel definitie

---

## 🔍 Bestanden Vinden

### Via VS Code

1. **Ctrl + P:** Quick open (typ bestandsnaam)
2. **Ctrl + Shift + F:** Zoek in alle bestanden
3. **Ctrl + Click:** Ga naar definitie (klik op functie/component naam)

### Via Command Line

```bash
# Vind alle TypeScript bestanden met "Customer" in naam
find . -name "*Customer*.tsx"

# Zoek naar tekst in bestanden
grep -r "api/customers" server/

# Toon mappenstructuur
tree -L 2  # (Windows: tree /F )
```

---

## 🌳 Overzicht Branches

We werken met **twee hoofdbranches**:

| Branch | Omgeving | Server Branch | Doel |
|--------|----------|---------------|------|
| `update/versie0.1` | **Test/Staging** | `update/versie0.1` op server | 🟡 Testen van nieuwe features voordat ze live gaan |
| `main` | **Production** | `main` op server | 🔴 Stabiele, live versie voor eindgebruikers op https://hub.dutchthrift.com |

### Workflow Overzicht

```
💻 Lokaal werken
    ↓ (git push origin update/versie0.1)
🟡 Test op update/versie0.1 branch
    ↓ (testen + partner approval)
✅ Akkoord?
    ↓ (merge update/versie0.1 → main)
🔴 Live op main (productie)
```

### Waarom Twee Branches?

✅ **Veiligheid:** Test nieuwe features zonder de live versie te verstoren  
✅ **Kwaliteit:** Bugs opsporen voordat gebruikers ze zien  
✅ **Controle:** Bewuste keuze wanneer iets live gaat  
✅ **Partner Review:** Collegiaal kunnen reviewen voor het live gaat  

### 🔒 Repository Status

**De repository is PRIVÉ** voor beveiliging:
- ✅ API keys en gevoelige data beschermd
- ✅ Business logica niet publiek zichtbaar
- ✅ Server gebruikt SSH key voor toegang
- ✅ Alleen geautoriseerde gebruikers hebben toegang

---

## 🔐 Repository & Server Setup

### Private Repository Toegang

De GitHub repository is **privé** ingesteld. Dit betekent:

**Voor Je PC:**
- Gebruik HTTPS met GitHub credentials
- Git vraagt om username/password bij push/pull (of gebruikt cached credentials)

**Voor De Server:**
- Server gebruikt **SSH key authenticatie**
- Geen wachtwoord nodig bij `git pull`
- Eenmalige setup (zie hieronder)

### SSH Key Setup (Eenmalig, Al Gedaan)

**ℹ️ Deze setup is al uitgevoerd, maar voor referentie:**

<details>
<summary>Klik om SSH setup stappen te zien</summary>

**Op de server:**
```bash
# 1. Genereer SSH key
ssh-keygen -t ed25519 -C "dutchthrift-server@github"
# Druk 3x Enter (default locatie, geen passphrase)

# 2. Toon public key
cat ~/.ssh/id_ed25519.pub
# Kopieer de output

# 3. Test GitHub verbinding
ssh -T git@github.com
# Moet tonen: "Hi Dutchthrift! You've successfully authenticated..."

# 4. Wijzig Git remote naar SSH
cd /var/www/dutchthrifthub
git remote set-url origin git@github.com:Dutchthrift/dutchthrifthub.git
```

**Op GitHub (website):**
1. Ga naar: https://github.com/settings/keys
2. Klik "New SSH key"
3. Title: `DutchThrift VPS Server`
4. Plak de public key
5. Klik "Add SSH key"

**✅ Nu kan de server zonder wachtwoord `git pull` doen!**

</details>

### Partner Toegang Geven

**Om je partner toegang te geven tot de private repository:**

1. Ga naar: https://github.com/Dutchthrift/dutchthrifthub/settings/access
2. Klik: **"Add people"**
3. Voer de GitHub username of email van je partner in
4. Selecteer rol:
   - **Write** = Kan code pushen/pullen en reviewen (aanbevolen voor development partner)
   - **Maintain** = Kan ook issues en settings beheren
   - **Admin** = Volledige controle
5. Klik: **"Add [username] to this repository"**

**✅ Je partner kan nu:**
- De repository zien
- Code pullen/pushen
- Pull Requests reviewen en goedkeuren
- Issues aanmaken

---

## 💻 Development Workflow

### Stap 1: Lokaal Ontwikkelen

```powershell
# Navigeer naar je project
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# Zorg dat je op de juiste branch bent (update/versie0.1 voor nieuwe features)
git checkout update/versie0.1

# Pull de laatste wijzigingen
git pull origin update/versie0.1

# Open project in VS Code
code .

# Start development server
npm run dev
```

### Stap 2: Test Lokaal

- Open browser: `http://localhost:5000`
- Test je wijzigingen grondig
- Check console voor errors

### Stap 3: Commit & Push Wijzigingen

```powershell
# Check welke bestanden zijn gewijzigd
git status

# Voeg ALLE wijzigingen toe
git add .

# OF specifieke bestanden:
git add server/routes.ts
git add client/src/components/Dashboard.tsx

# Commit met duidelijke beschrijving
git commit -m "Feature: Nieuwe dashboard statistieken toegevoegd"

# Push naar GitHub (update/versie0.1 branch)
git push origin update/versie0.1
```

#### 💡 Commit Message Richtlijnen

| Prefix | Gebruik voor | Voorbeeld |
|--------|-------------|-----------|
| `Feature:` | Nieuwe functionaliteit | `Feature: Klant export knop toegevoegd` |
| `Fix:` | Bug fix | `Fix: Login error bij verkeerd wachtwoord` |
| `Update:` | Bestaande functie verbetering | `Update: Dashboard laadt nu sneller` |
| `Refactor:` | Code cleanup zonder functie wijziging | `Refactor: API calls geoptimaliseerd` |
| `Database:` | Database schema wijzigingen | `Database: Nieuwe tabel 'notifications' toegevoegd` |
| `Docs:` | Documentatie update | `Docs: README bijgewerkt` |

---

## 🧪 Testen op update/versie0.1 Branch

### Deployen naar Test Server

**Stap 1:** Verbind met server via MobaXterm

```bash
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179
```

**Stap 2:** Navigeer naar project directory

```bash
cd /var/www/dutchthrifthub
```

**Stap 3:** Check huidige branch

```bash
git branch
# Moet => * update/versie0.1 tonen
```

**Stap 4:** Schakel naar update/versie0.1 (als je op main staat)

```bash
# Als je op main staat:
git checkout update/versie0.1

# Pull laatste wijzigingen van update/versie0.1
git pull origin update/versie0.1
```

**Stap 5:** Installeer dependencies & rebuild

```bash
# Installeer nieuwe packages (als package.json gewijzigd)
npm install

# Build de applicatie
npm run build
```

**Stap 6:** Restart applicatie

```bash
# Restart via PM2
pm2 restart dutchthrift

# Check of alles draait
pm2 status

# Bekijk logs voor errors
pm2 logs dutchthrift --lines 50
```

**Stap 7:** Test de applicatie

1. Open browser: `https://hub.dutchthrift.com`
2. Test alle nieuwe functionaliteit
3. Check of oude features nog werken
4. Test op verschillende devices (desktop, mobile)

### Test Checklist ✅

- [ ] Applicatie start zonder errors
- [ ] Login werkt
- [ ] Dashboard toont correcte data
- [ ] Nieuwe features werken zoals verwacht
- [ ] Geen console errors in browser (F12 → Console)
- [ ] Database queries werken (check server logs)
- [ ] Mobile responsive design werkt
- [ ] Performance is acceptabel

---

## 🚀 Deployen naar Production (main)

**⚠️ BELANGRIJK:** Deploy alleen naar `main` nadat:
1. ✅ Je grondig getest hebt op `update/versie0.1`
2. ✅ **Je partner heeft goedkeuring gegeven**
3. ✅ Alle test checklist items zijn afgevinkt

### 👥 Partner Approval Proces

**Voordat je naar production gaat:**

1. **Informeer je partner:**
   - Deel de wijzigingen die je hebt gemaakt
   - Link naar test versie (update/versie0.1 branch op server)
   - Vraag om review en test

2. **Partner test op update/versie0.1:**
   - Partner bekijkt nieuwe features
   - Partner test functionaliteit
   - Partner geeft feedback of goedkeuring

3. **Na goedkeuring:**
   - Merge `update/versie0.1` → `main`
   - Deploy naar production

**💡 Tip:** Gebruik GitHub Pull Requests voor transparante review!

---

### Deployment Methoden

### Methode 1: Merge via GitHub Pull Request (Aanbevolen voor Partner Review)

**Stap 1:** Ga naar GitHub

```
https://github.com/Dutchthrift/dutchthrifthub
```

**Stap 2:** Maak een Pull Request

1. Klik op **"Pull requests"** tab
2. Klik **"New pull request"**
3. Stel in:
   - **Base:** `main`
   - **Compare:** `update/versie0.1`
4. Klik **"Create pull request"**
5. Voeg beschrijving toe:
   ```
   ## Wijzigingen
   - Feature X toegevoegd
   - Bug Y opgelost
   - Database tabel Z toegevoegd
   
   ## Getest op update/versie0.1
   - [x] Alle features werken
   - [x] Geen errors
   - [x] Database migratie succesvol
   ```
6. Klik **"Create pull request"**
7. Review de wijzigingen
8. Klik **"Merge pull request"**
9. Klik **"Confirm merge"**

**Stap 3:** Deploy op server

```bash
# Verbind met server
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179

# Navigeer naar project
cd /var/www/dutchthrifthub

# Schakel naar main branch
git checkout main

# Pull de gemerge'd code
git pull origin main

# Installeer dependencies
npm install

# Build
npm run build

# Restart
pm2 restart dutchthrift

# Check logs
pm2 logs dutchthrift --lines 30
```

### Methode 2: Direct Merge (Lokaal)

```powershell
# Op je PC
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# Schakel naar main
git checkout main

# Pull laatste main
git pull origin main

# Merge update/versie0.1 in main
git merge update/versie0.1

# Los eventuele conflicts op (VS Code helpt hierbij)

# Push naar GitHub
git push origin main

# Deploy op server (zie Methode 1, Stap 3)
```

### Post-Deployment Checks ✅

- [ ] Website bereikbaar: `https://hub.dutchthrift.com`
- [ ] Geen errors in `pm2 logs dutchthrift`
- [ ] Login werkt
- [ ] Users kunnen normaal werken
- [ ] Database data is intact
- [ ] Nieuwe features zijn live

---

## 🗄️ Database Migraties

### Wat Zijn Database Migraties?

Wanneer je **nieuwe tabellen toevoegt** of **bestaande tabellen wijzigt** in je code (`db/schema.ts`), moet de **database server geüpdatet** worden om deze wijzigingen te reflecteren.

### Hoe Werkt Het?

```
Code Wijziging → Schema Update → Database Migratie → Server Update
```

### Voorbeeld Workflow: Nieuwe Tabel Toevoegen

#### Stap 1: Definieer nieuwe tabel in code

**Bestand:** `db/schema.ts`

```typescript
// Voorbeeld: Nieuwe 'notifications' tabel
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
```

#### Stap 2: Test lokaal

```powershell
# Op je PC
npm run dev

# Drizzle detecteert automatisch schema wijzigingen
# Check console voor migratie berichten
```

#### Stap 3: Commit & push naar update/versie0.1

```powershell
git add db/schema.ts
git commit -m "Database: Nieuwe 'notifications' tabel toegevoegd"
git push origin update/versie0.1
```

#### Stap 4: Deploy naar test server & run migratie

```bash
# Verbind met server
ssh -i "C:\Users\Niek Oenema\.ssh\strato_vps" root@85.215.181.179

# Navigeer naar project
cd /var/www/dutchthrifthub

# Pull wijzigingen
git pull origin update/versie0.1

# Installeer dependencies
npm install

# 🔥 RUN DATABASE MIGRATIE
npm run db:push

# Dit commando:
# 1. Leest db/schema.ts
# 2. Vergelijkt met huidige database
# 3. Maakt nieuwe tabellen/kolommen aan
# 4. Update bestaande tabellen
```

**Output voorbeeld:**

```
📦 Applying migrations...
✅ Created table: notifications
✅ Added column: user_id (references users.id)
✅ Added column: message
✅ Added column: is_read
✅ Added column: created_at
🎉 Migration successful!
```

#### Stap 5: Verificar database wijzigingen

```bash
# Open PostgreSQL
sudo -u postgres psql -d dutchthrift

# Check of tabel bestaat
\dt

# Bekijk tabel structuur
\d notifications

# Toon tabellen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

# Exit
\q
```

#### Stap 6: Rebuild & restart applicatie

```bash
npm run build
pm2 restart dutchthrift
pm2 logs dutchthrift --lines 30
```

#### Stap 7: Test nieuwe functionaliteit

- Open `https://hub.dutchthrift.com`
- Test de nieuwe feature die de nieuwe tabel gebruikt
- Check of data correct wordt opgeslagen

### Database Migratie: Kolom Toevoegen aan Bestaande Tabel

**Voorbeeld:** Voeg `phone_number` toe aan `customers` tabel

```typescript
// db/schema.ts
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  // ⬇️ NIEUWE KOLOM
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Deploy:**

```bash
# Op server
cd /var/www/dutchthrifthub
git pull origin update/versie0.1
npm run db:push  # ✅ Voegt kolom toe aan bestaande tabel
npm run build
pm2 restart dutchthrift
```

### Database Migratie: Kolom Wijzigen

**⚠️ LET OP:** Wijzigen van kolommen kan data-verlies veroorzaken!

**Veilige workflow:**

1. **Backup maken eerst!**

```bash
# Maak backup voordat je schema wijzigt
sudo -u postgres pg_dump -d dutchthrift > /tmp/backup_before_migration_$(date +%Y%m%d).sql
```

2. **Wijzig schema**

```typescript
// Voorbeeld: Verander email van optioneel naar verplicht
export const customers = pgTable("customers", {
  email: text("email").notNull().unique(), // .notNull() toegevoegd
});
```

3. **Run migratie**

```bash
npm run db:push
```

4. **Test grondig**

### Database Migratie Commands

```bash
# 🔥 PUSH schema wijzigingen naar database (gebruikt in productie)
npm run db:push

# 📝 Genereer migratie bestanden (alternatief, meer controle)
npm run db:generate

# ▶️ Run gegenereerde migraties
npm run db:migrate

# 🔍 Open Drizzle Studio (database GUI)
npm run db:studio
```

### Migratie Troubleshooting

#### Error: Permission denied

```bash
# Fix permissions
sudo -u postgres psql -d dutchthrift << EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dutchthrift_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dutchthrift_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dutchthrift_user;
EOF
```

#### Error: Column already exists

```bash
# Schema staat niet in sync met database
# Oplossing 1: Verwijder kolom handmatig en run migratie opnieuw
sudo -u postgres psql -d dutchthrift
ALTER TABLE notifications DROP COLUMN message;
\q

# Run migratie opnieuw
npm run db:push

# Oplossing 2: Reset schema (⚠️ VERLIEST DATA!)
# Alleen in development/test!
```

#### Error: Cannot connect to database

```bash
# Check of PostgreSQL draait
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check .env bestand
cat /var/www/dutchthrifthub/.env | grep DATABASE_URL
```

### Migratie Best Practices ✅

1. **Altijd backup maken voor productie migraties**
   ```bash
   sudo -u postgres pg_dump -d dutchthrift > /tmp/backup_$(date +%Y%m%d).sql
   ```

2. **Test migraties eerst op update/versie0.1**
   - Nooit direct naar main
   - Test of data intact blijft

3. **Gebruik descriptive commit messages**
   ```bash
   git commit -m "Database: Nieuwe notifications tabel + foreign key naar users"
   ```

4. **Document breaking changes**
   - Vermeldt in commit message als data-structuur wijzigt
   - Update API endpoints die deze data gebruiken

5. **Migraties zijn onomkeerbaar in Drizzle ORM**
   - `db:push` past direct aan zonder history
   - Voor productie: overweeg manual SQL migraties met rollback plan

---

## 🔧 Troubleshooting

### Git Conflicts bij Merge

```powershell
# Conflict tijdens merge?
git status  # Toon conflicted files

# Open in VS Code
code .

# VS Code toont conflicts visueel
# Kies: "Accept Current" / "Accept Incoming" / "Accept Both"

# Na oplossen:
git add .
git commit -m "Merge: Resolved conflicts"
git push origin main
```

### Server Heeft Oudere Code

```bash
# Check welke commit server heeft
cd /var/www/dutchthrifthub
git log -1

# Vergelijk met GitHub
# Is server achter? Pull:
git pull origin update/versie0.1  # Of main
```

### Database Out of Sync

```bash
# Schema in code matcht niet met database
# Fix:
npm run db:push  # Force sync

# Als dit faalt, check schema.ts vs database:
sudo -u postgres psql -d dutchthrift
\dt  # Toon alle tabellen
\d users  # Toon structuur van 'users'
\q
```

### PM2 App Crashed

```bash
# Check status
pm2 status

# Start opnieuw
pm2 start dutchthrift

# Als het blijft crashen, check logs:
pm2 logs dutchthrift --lines 100

# Vaak voorkomende oorzaken:
# - Database connection error (check .env)
# - Port 5000 in gebruik (kill proces: sudo lsof -i :5000)
# - Syntax error in code (fix & rebuild)
```

### Build Errors

```bash
# Error tijdens npm run build?

# Check Node version
node -v  # Moet 20.x zijn

# Clear cache & rebuild
rm -rf node_modules dist
npm install
npm run build
```

---

## 📊 Quick Reference

### Daily Workflow

```powershell
# 1. LOKAAL WERKEN (update/versie0.1)
git checkout update/versie0.1
git pull origin update/versie0.1
# ... maak wijzigingen ...
npm run dev  # Test lokaal
git add .
git commit -m "Feature: X toegevoegd"
git push origin update/versie0.1

# 2. DEPLOY NAAR TEST
# (via MobaXterm / SSH)
cd /var/www/dutchthrifthub
git checkout update/versie0.1
git pull origin update/versie0.1
npm install
npm run build
pm2 restart dutchthrift
pm2 logs dutchthrift

# 3. TEST & VALIDATE
# Open https://hub.dutchthrift.com
# Test alle functionaliteit

# 4. DEPLOY NAAR PRODUCTIE (als alles werkt)
git checkout main
git merge update/versie0.1
git push origin main

# (op server)
git checkout main
git pull origin main
npm install
npm run build
pm2 restart dutchthrift
```

### Database Migration Workflow

```bash
# 1. Wijzig db/schema.ts lokaal
# 2. Test lokaal
npm run dev

# 3. Push naar update/versie0.1
git add db/schema.ts
git commit -m "Database: Nieuwe tabel X"
git push origin update/versie0.1

# 4. Deploy & migrate op test server
cd /var/www/dutchthrifthub
git pull origin update/versie0.1
npm run db:push  # 🔥 DATABASE MIGRATIE
npm run build
pm2 restart dutchthrift

# 5. Verify database
sudo -u postgres psql -d dutchthrift
\dt  # Check tabellen
\q

# 6. Test applicatie

# 7. Als alles werkt: merge naar main (zie Daily Workflow stap 4)
```

---

## 🎯 Checklist Template

### Voor Elke Deployment (update/versie0.1)

- [ ] Code getest lokaal (`npm run dev`)
- [ ] Commit message is descriptief
- [ ] Gepusht naar GitHub (`git push origin update/versie0.1`)
- [ ] Server geüpdatet (`git pull origin update/versie0.1`)
- [ ] Dependencies geïnstalleerd (`npm install`)
- [ ] Database migratie gedaan (indien schema wijzigingen: `npm run db:push`)
- [ ] Applicatie gebuild (`npm run build`)
- [ ] PM2 gerestart (`pm2 restart dutchthrift`)
- [ ] Logs gecontroleerd (geen errors)
- [ ] Website getest in browser
- [ ] Mobile responsive getest

### Voor Production Deployment (main)

- [ ] **update/versie0.1 grondig getest (minimaal 1 dag)**
- [ ] Geen bekende bugs
- [ ] Database backup gemaakt (voor schema wijzigingen)
- [ ] Pull request gemaakt & reviewed (optioneel)
- [ ] Code gemerged naar main
- [ ] Server geüpdatet (`git pull origin main`)
- [ ] Database migratie gedaan (indien schema wijzigingen)
- [ ] Applicatie gebuild & gerestart
- [ ] Logs gecontroleerd
- [ ] **Live website getest**
- [ ] Users geïnformeerd (bij grote wijzigingen)

---

## 📞 Support & Resources

- **Complete Server Docs:** Zie hoofddocumentatie
- **Drizzle ORM Docs:** https://orm.drizzle.team/docs/overview
- **PM2 Docs:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Git Docs:** https://git-scm.com/doc

---

**🎉 Succesvol updaten! Voor vragen of problemen, check eerst de Troubleshooting sectie.**

---

_Laatste update: 4 December 2024 - DutchThrift Development Team_

