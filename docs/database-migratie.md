# Database Migratie Handleiding

Dit document beschrijft hoe je de database migratie uitvoert op de productieserver om de nieuwe `repairType` functionaliteit te activeren.

## Probleem

De applicatie toont de volgende foutmelding:
```
Error fetching repairs: PostgresError: column "repair_type" does not exist
```

Dit komt doordat het database schema is bijgewerkt in de code, maar de database zelf nog niet is gemigreerd.

---

## Oplossing: Stap voor Stap

### 1. Verbind met de server via SSH

```bash
ssh root@85.215.181.179
```

### 2. Navigeer naar de projectmap

```bash
cd /var/www/dutchthrifthub
```

### 3. Haal de laatste code op van GitHub

```bash
git pull origin update/versie0.1
```

### 4. Voer de database migratie uit

```bash
npm run db:push
```

### 5. Herstart de applicatie (indien nodig)

```bash
pm2 restart dutchthrifthub
```

---

## Mogelijke Problemen

### "must be owner of table" fout

Als je deze fout krijgt:
```
error: must be owner of table customers
```

Voer dan eerst het ownership fix script uit:
```bash
sudo -u postgres psql -d dutchthrift -f migrations/fix_ownership.sql
```

Probeer daarna opnieuw:
```bash
npm run db:push
```

---

## Verificatie

Na succesvolle migratie:

1. Open de applicatie in je browser
2. Ga naar de **Reparaties** pagina
3. De pagina zou nu zonder fouten moeten laden
4. Je kunt nu reparaties slepen tussen statuskolommen

---

## Nieuwe Functionaliteit na Migratie

Na de migratie werkt het volgende:

- ✅ **Reparatietypes**: Onderscheid tussen "Klantreparaties" en "Inkoopreparaties"
- ✅ **Vereenvoudigde statussen**: 4 statussen (Nieuw, In Reparatie, Voltooid, Retour)
- ✅ **Drag-and-drop**: Sleep reparaties naar andere statuskolommen
- ✅ **Rechtermuisklik menu**: Snel status wijzigen via context menu

---

## Contact

Bij problemen, neem contact op met de ontwikkelaar.
