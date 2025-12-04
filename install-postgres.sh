#!/bin/bash

################################################################################
# DutchThrift - PostgreSQL & pgAdmin Automatische Installatie Script
# 
# Dit script installeert:
# - PostgreSQL 14+
# - pgAdmin 4 (Web Interface)
# - Database "dutchthrift"
# - Gebruiker "dutchthrift_user"
# - Automatische backups
#
# Gebruik: sudo ./install-postgres.sh
################################################################################

set -e  # Stop bij errors

# Kleuren voor output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functies
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# Check of script als root draait
if [ "$EUID" -ne 0 ]; then
    print_error "Dit script moet als root draaien. Gebruik: sudo ./install-postgres.sh"
    exit 1
fi

echo "========================================="
echo "  DutchThrift PostgreSQL Installatie"
echo "========================================="
echo ""

# Vraag database wachtwoord
print_info "Kies een veilig wachtwoord voor de database gebruiker:"
read -sp "Database wachtwoord: " DB_PASSWORD
echo ""
read -sp "Bevestig wachtwoord: " DB_PASSWORD_CONFIRM
echo ""

if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
    print_error "Wachtwoorden komen niet overeen!"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    print_error "Wachtwoord mag niet leeg zijn!"
    exit 1
fi

echo ""
print_info "Database naam: dutchthrift"
print_info "Database gebruiker: dutchthrift_user"
print_info "Database host: localhost"
print_info "Database port: 5432"
echo ""
read -p "Doorgaan met installatie? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_error "Installatie geannuleerd."
    exit 1
fi

echo ""
echo "========================================="
echo "  Starten installatie..."
echo "========================================="
echo ""

# 1. System update
print_info "System packages updaten..."
apt update -qq
print_success "System packages geüpdatet"

# 2. PostgreSQL installeren
print_info "PostgreSQL installeren..."
apt install -y postgresql postgresql-contrib > /dev/null 2>&1
print_success "PostgreSQL geïnstalleerd"

# 3. Start PostgreSQL service
print_info "PostgreSQL service starten..."
systemctl start postgresql
systemctl enable postgresql > /dev/null 2>&1
print_success "PostgreSQL service gestart"

# 4. Database aanmaken
print_info "Database 'dutchthrift' aanmaken..."
sudo -u postgres psql -c "CREATE DATABASE dutchthrift;" 2>/dev/null || print_info "Database bestaat al"
print_success "Database aangemaakt"

# 5. Gebruiker aanmaken
print_info "Gebruiker 'dutchthrift_user' aanmaken..."
sudo -u postgres psql -c "DROP USER IF EXISTS dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -c "CREATE USER dutchthrift_user WITH PASSWORD '$DB_PASSWORD';" > /dev/null 2>&1
print_success "Gebruiker aangemaakt"

# 6. Rechten instellen
print_info "Database rechten instellen..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dutchthrift TO dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -d dutchthrift -c "GRANT ALL ON SCHEMA public TO dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -d dutchthrift -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -d dutchthrift -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -d dutchthrift -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dutchthrift_user;" > /dev/null 2>&1
sudo -u postgres psql -d dutchthrift -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dutchthrift_user;" > /dev/null 2>&1
print_success "Rechten ingesteld"

# 7. Backup directory aanmaken
print_info "Backup directory aanmaken..."
mkdir -p /var/backups/dutchthrift
chmod 755 /var/backups/dutchthrift
print_success "Backup directory aangemaakt"

# 8. Backup script maken
print_info "Backup script aanmaken..."
cat > /usr/local/bin/backup-dutchthrift.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/dutchthrift"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="dutchthrift"
DB_USER="dutchthrift_user"

# Maak backup
PGPASSWORD="" pg_dump -U $DB_USER -d $DB_NAME -h localhost > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Behoud alleen laatste 7 dagen
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete

echo "Backup completed: backup_$TIMESTAMP.sql"
EOF

chmod +x /usr/local/bin/backup-dutchthrift.sh
print_success "Backup script aangemaakt"

# 9. Cron job opzetten
print_info "Dagelijkse backup cron job opzetten..."
(crontab -l 2>/dev/null | grep -v backup-dutchthrift; echo "0 2 * * * /usr/local/bin/backup-dutchthrift.sh > /var/log/dutchthrift-backup.log 2>&1") | crontab -
print_success "Cron job ingesteld (dagelijks om 02:00)"

# 10. pgAdmin 4 installeren (optioneel, kan even duren)
print_info "pgAdmin 4 installeren (dit kan even duren)..."
apt install -y curl ca-certificates > /dev/null 2>&1

# Voeg pgAdmin repository toe
curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg > /dev/null 2>&1

echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list

apt update -qq
apt install -y pgadmin4-web > /dev/null 2>&1

# Configureer pgAdmin web mode
print_info "pgAdmin configureren..."
echo -e "$DB_PASSWORD\n$DB_PASSWORD" | /usr/pgadmin4/bin/setup-web.sh --yes > /dev/null 2>&1 || print_info "pgAdmin setup al gedaan"

print_success "pgAdmin 4 geïnstalleerd"

# 11. Test backup
print_info "Test backup maken..."
sudo -u postgres PGPASSWORD="$DB_PASSWORD" pg_dump -U dutchthrift_user -d dutchthrift -h localhost > /var/backups/dutchthrift/backup_test_$(date +%Y%m%d).sql 2>/dev/null
print_success "Test backup succesvol"

# Klaar!
echo ""
echo "========================================="
echo "  ✅ Installatie Compleet!"
echo "========================================="
echo ""
echo "Database Informatie:"
echo "  Database: dutchthrift"
echo "  User: dutchthrift_user"
echo "  Host: localhost"
echo "  Port: 5432"
echo ""
echo "Connection String:"
echo "  postgresql://dutchthrift_user:${DB_PASSWORD}@localhost:5432/dutchthrift"
echo ""
echo "pgAdmin Web Interface:"
echo "  URL: http://$(hostname -I | awk '{print $1}'):5050"
echo "  (Configureer tijdens eerste login)"
echo ""
echo "Backups:"
echo "  Locatie: /var/backups/dutchthrift"
echo "  Schema: Dagelijks om 02:00"
echo "  Retentie: 7 dagen"
echo ""
echo "Volgende stappen:"
echo "  1. Update je .env file met de connection string"
echo "  2. Run: npm run db:push"
echo "  3. Test je applicatie"
echo ""
echo "========================================="
