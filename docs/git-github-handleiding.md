# 📚 Git & GitHub Handleiding voor Beginners

> Een complete gids voor het werken met Git, branches, backups en dagelijkse workflow voor het DutchThriftHub project.

---

## 📖 Inhoudsopgave

1. [Wat is Git en GitHub?](#wat-is-git-en-github)
2. [Basis Concepten](#basis-concepten)
3. [Eerste Installatie en Setup](#eerste-installatie-en-setup)
4. [Dagelijkse Workflow](#dagelijkse-workflow)
5. [Werken met Branches](#werken-met-branches)
6. [Backups naar GitHub](#backups-naar-github)
7. [Veelgebruikte Commando's](#veelgebruikte-commandos)
8. [Probleemoplossing](#probleemoplossing)

---

## 🤔 Wat is Git en GitHub?

### Git
**Git** is een versiebeheersysteem dat je helpt om:
- Alle wijzigingen in je code bij te houden
- Terug te gaan naar eerdere versies
- Samen te werken met anderen zonder elkaars werk te overschrijven

### GitHub
**GitHub** is een online platform waar je:
- Je Git repositories (projecten) kunt opslaan
- Backups van je code bewaart
- Kunt samenwerken met anderen

**Simpel gezegd:** Git = lokaal op je computer, GitHub = online backup en samenwerking

---

## 🎯 Basis Concepten

### Repository (Repo)
Een "repository" is je projectmap met alle bestanden én de volledige geschiedenis van wijzigingen.

### Commit
Een "commit" is een opslagmoment - een snapshot van je project op een bepaald moment. Het is als een save-punt in een game.

### Branch
Een "branch" is een aparte werkomgeving waar je aan nieuwe features kunt werken zonder de hoofdversie (main) te beïnvloeden.

### Main Branch
De **main** branch is de hoofd-directory, de stabiele versie van je project. Dit is de "productieklare" code.

### Remote
De "remote" is de online versie van je repository op GitHub (de backup in de cloud).

---

## 🛠️ Eerste Installatie en Setup

### 1. Git Installeren (als je dit nog niet hebt)

Download en installeer Git van: https://git-scm.com/download/win

### 2. Git Configureren

Open PowerShell of Command Prompt en voer deze commando's uit:

```powershell
# Stel je naam in (wordt zichtbaar in commits)
git config --global user.name "Jouw Naam"

# Stel je email in (gebruik hetzelfde als je GitHub account)
git config --global user.email "jouw.email@example.com"

# Controleer of het gelukt is
git config --list
```

### 3. GitHub Authenticatie Instellen

Voor Windows wordt aanbevolen om **Git Credential Manager** te gebruiken (komt mee met Git):

```powershell
# Dit wordt automatisch gevraagd bij je eerste push
# Je hoeft alleen maar in te loggen via de browser wanneer gevraagd
```

**Alternatief: SSH Keys** (voor gevorderden)
- Volg de GitHub gids: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

---

## 🚀 Dagelijkse Workflow

### ☀️ Begin van de Dag

```powershell
# 1. Ga naar je project directory
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"

# 2. Controleer op welke branch je zit
git branch

# 3. Haal de nieuwste wijzigingen op van GitHub
git pull origin main
```

### 💻 Tijdens het Werken

```powershell
# 1. Check regelmatig de status van je wijzigingen
git status

# 2. Bekijk wat er precies gewijzigd is
git diff

# 3. Elke 30-60 minuten of na een belangrijke wijziging:
#    Voeg je wijzigingen toe aan de staging area
git add .

# 4. Maak een commit met een duidelijke beschrijving
git commit -m "Beschrijving van wat je hebt gedaan"

# Voorbeelden van goede commit messages:
# git commit -m "Fix: Login bug opgelost"
# git commit -m "Feature: Nieuwe dashboard widget toegevoegd"
# git commit -m "Update: Styling van homepage verbeterd"
```

### 🌙 Einde van de Dag

```powershell
# 1. Controleer of alles gecommit is
git status

# 2. Als er nog uncommitted wijzigingen zijn:
git add .
git commit -m "Eindstand van vandaag: [korte beschrijving]"

# 3. Push alles naar GitHub (backup!)
git push origin <jouw-branch-naam>

# Bijvoorbeeld:
# git push origin feature/nieuwe-functie
# of voor main branch:
# git push origin main
```

---

## 🌿 Werken met Branches

### Waarom Branches?

Branches zijn essentieel voor veilig ontwikkelen:
- **main** = stabiele, werkende versie (productie)
- **feature branches** = experimenteren en nieuwe functies ontwikkelen
- Als iets mis gaat in een branch, is **main** nog steeds veilig!

### Een Nieuwe Branch Maken

```powershell
# 1. Zorg dat je main up-to-date is
git checkout main
git pull origin main

# 2. Maak een nieuwe branch aan en schakel er meteen naar over
git checkout -b feature/naam-van-feature

# Voorbeelden:
# git checkout -b feature/nieuwe-login
# git checkout -b feature/dashboard-update
# git checkout -b fix/bug-in-forms
```

### Tussen Branches Wisselen

```powershell
# Ga naar de main branch
git checkout main

# Ga naar een andere branch
git checkout feature/naam-van-feature

# Bekijk alle branches
git branch

# Bekijk ook remote branches
git branch -a
```

### Branch naar Main Mergen (Samenvoegen)

```powershell
# 1. Zorg dat je feature branch up-to-date is
git checkout feature/jouw-feature
git add .
git commit -m "Laatste wijzigingen voor merge"
git push origin feature/jouw-feature

# 2. Ga naar main
git checkout main

# 3. Haal laatste wijzigingen op
git pull origin main

# 4. Merge je feature branch in main
git merge feature/jouw-feature

# 5. Als er geen conflicten zijn, push naar GitHub
git push origin main

# 6. (Optioneel) Verwijder de oude feature branch lokaal
git branch -d feature/jouw-feature

# 7. (Optioneel) Verwijder de branch ook van GitHub
git push origin --delete feature/jouw-feature
```

### Best Practices voor Branches

1. **Gebruik duidelijke namen:**
   - `feature/nieuwe-functie` - voor nieuwe features
   - `fix/bug-naam` - voor bug fixes
   - `update/component-naam` - voor updates
   - `experiment/idee` - voor experimenten

2. **Houd branches klein en gefocust:**
   - Één branch = één feature of fix
   - Merge regelmatig terug naar main

3. **Main branch beschermen:**
   - Test je code voordat je merged naar main
   - Main moet altijd werkend zijn

---

## 💾 Backups naar GitHub

### Waarom Backuppen?

- **Beveiliging:** Als je laptop crasht, is je code veilig
- **Toegankelijkheid:** Werk op elke computer met internet
- **Samenwerking:** Anderen kunnen je code zien en bijdragen
- **Versiegeschiedenis:** Ga terug naar elke eerdere versie

### Dagelijkse Backup Routine

```powershell
# Simpele dagelijkse backup (als je op main werkt)
git add .
git commit -m "Backup: [datum] - [korte beschrijving]"
git push origin main

# Backup van een feature branch
git add .
git commit -m "Progress: [feature naam] - [wat je hebt gedaan]"
git push origin feature/naam-van-feature
```

### Wekelijkse Backup Checklist

```powershell
# 1. Controleer of alle branches gepushed zijn
git branch -a

# 2. Voor elke locale branch die je wilt bewaren:
git checkout naam-van-branch
git push origin naam-van-branch

# 3. Maak een overzicht van je commits deze week
git log --since="1 week ago" --oneline

# 4. (Optioneel) Maak een release tag voor belangrijke mijlpalen
git tag -a v1.0.0 -m "Versie 1.0.0 - Eerste stabiele release"
git push origin v1.0.0
```

### Emergency Backup

Als je snel alles wilt backuppen zonder commits te organiseren:

```powershell
# Maak een quick commit van alles
git add .
git commit -m "Emergency backup - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push origin main
```

---

## 📋 Veelgebruikte Commando's

### Status en Informatie

```powershell
# Bekijk de status van je working directory
git status

# Bekijk de commit geschiedenis
git log

# Korte versie van de geschiedenis
git log --oneline

# Bekijk wat er gewijzigd is (unstaged)
git diff

# Bekijk wat er gewijzigd is (staged)
git diff --staged

# Welke branch ben ik?
git branch

# Alle branches (inclusief remote)
git branch -a
```

### Wijzigingen Maken

```powershell
# Voeg specifieke file toe
git add bestandsnaam.js

# Voeg alle wijzigingen toe
git add .

# Voeg alleen gewijzigde files toe (geen nieuwe)
git add -u

# Commit met message
git commit -m "Jouw boodschap hier"

# Add en commit in één keer (alleen voor tracked files)
git commit -am "Jouw boodschap"
```

### Synchroniseren met GitHub

```powershell
# Download wijzigingen (maar merge niet)
git fetch origin

# Download en merge wijzigingen
git pull origin main

# Upload je commits naar GitHub
git push origin main

# Push een nieuwe branch voor het eerst
git push -u origin feature/nieuwe-branch
```

### Ongedaan Maken

```powershell
# Unstage een file (voeg toe ongedaan maken)
git restore --staged bestandsnaam.js

# Gooi wijzigingen in een file weg (VOORZICHTIG!)
git restore bestandsnaam.js

# Gooi alle unstaged wijzigingen weg (VOORZICHTIG!)
git restore .

# Laatste commit ongedaan maken (maar wijzigingen behouden)
git reset --soft HEAD~1

# Laatste commit ongedaan maken (wijzigingen ook weggooien) (GEVAARLIJK!)
git reset --hard HEAD~1

# Ga terug naar een specifieke commit
git checkout <commit-hash>
```

---

## 🆘 Probleemoplossing

### "Everything up-to-date" maar ik zie mijn wijzigingen niet

**Probleem:** Je hebt wijzigingen gemaakt maar `git push` zegt "everything up-to-date"

**Oplossing:**
```powershell
# Je bent waarschijnlijk vergeten te committen
git status
git add .
git commit -m "Mijn wijzigingen"
git push origin main
```

### Merge Conflict

**Probleem:** Bij een merge of pull krijg je een conflict

**Oplossing:**
```powershell
# 1. Git vertelt je welke files conflicten hebben
git status

# 2. Open de files en zoek naar:
# <<<<<<< HEAD
# Jouw code
# =======
# Andere code
# >>>>>>> branch-name

# 3. Bewerk de file handmatig en verwijder de markers
# 4. Voeg de opgeloste files toe
git add conflicted-file.js

# 5. Commit de merge
git commit -m "Merge conflict opgelost"
```

### Verkeerde Branch

**Probleem:** Je hebt per ongeluk op de verkeerde branch gewerkt

**Oplossing:**
```powershell
# Als je nog niet gecommit hebt:
git stash                          # Bewaar je wijzigingen tijdelijk
git checkout correcte-branch        # Ga naar de juiste branch
git stash pop                       # Haal je wijzigingen terug

# Als je al gecommit hebt:
git log                             # Kopieer de commit hash
git checkout correcte-branch        # Ga naar de juiste branch
git cherry-pick <commit-hash>       # Kopieer de commit naar deze branch
```

### Wachtwoord Steeds Opnieuw Invoeren

**Probleem:** Git vraagt steeds om je GitHub wachtwoord

**Oplossing:**
```powershell
# Gebruik Git Credential Manager (komt met Git voor Windows)
git config --global credential.helper manager-core

# Of gebruik SSH keys (zie GitHub documentatie)
```

### ".gitignore werkt niet"

**Probleem:** Files die in .gitignore staan worden toch getracked

**Oplossing:**
```powershell
# Git moet de cache vergeten
git rm -r --cached .
git add .
git commit -m "Fix .gitignore"
```

### Alles is Kapot, Hulp!

**Noodoplossing - Ga terug naar laatste werkende versie:**

```powershell
# 1. Backup je huidige wijzigingen (voor het geval je ze nog nodig hebt)
# Kopieer de hele projectmap naar een veilige plek

# 2. Harde reset naar laatste commit op GitHub
git fetch origin
git reset --hard origin/main

# 3. Verwijder alle untracked files
git clean -fd
```

---

## 🎓 Tips voor Succes

### 1. Commit Vaak
- Kleine, regelmatige commits zijn beter dan grote, zeldzame commits
- Het is makkelijker om problemen op te sporen

### 2. Schrijf Duidelijke Commit Messages
```
❌ Slecht: "fix"
❌ Slecht: "update"
✅ Goed: "Fix: Login button werkt niet op mobile"
✅ Goed: "Feature: Dashboard toont nu sales statistieken"
```

### 3. Pull Voordat je Push
```powershell
# Altijd eerst de laatste versie ophalen
git pull origin main
# Dan pas pushen
git push origin main
```

### 4. Test Voordat je Merged naar Main
- Feature branch: experimenteren mag
- Main branch: moet altijd werken!

### 5. Gebruik .gitignore
Voeg files toe aan `.gitignore` die niet in GitHub horen:
- `node_modules/`
- `.env` (bevat secrets!)
- `*.log`
- Database bestanden
- Temporary bestanden

---

## 📅 Snelle Referentie: Dagelijkse Checklist

### 🌅 Start van de Dag
```powershell
cd "d:\Niek Oenema\Documents\ai\projecten\dutchthrifthub"
git pull origin main
git checkout -b feature/vandaag-werken-aan
```

### 💪 Tijdens het Werk (elk uur)
```powershell
git add .
git commit -m "Progress: [wat je hebt gedaan]"
```

### 🌆 Einde van de Dag
```powershell
git add .
git commit -m "Eindstand: [samenvatting van vandaag]"
git push origin feature/vandaag-werken-aan
```

### 📆 Einde van de Week
```powershell
git checkout main
git merge feature/vandaag-werken-aan
git push origin main
git branch -d feature/vandaag-werken-aan
```

---

## 🔗 Nuttige Links

- **Git Documentatie:** https://git-scm.com/doc
- **GitHub Guides:** https://guides.github.com/
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf
- **Interactieve Git Tutorial:** https://learngitbranching.js.org/

---

## ❓ Vragen?

Als je vastloopt:
1. Check eerst de [Probleemoplossing](#probleemoplossing) sectie
2. Google je error message + "git"
3. Vraag om hulp met `git status` output

**Onthoud:** Met Git kun je bijna altijd je werk terughalen, dus wees niet bang om te experimenteren! 🚀
