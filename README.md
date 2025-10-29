# Update Database
npx prisma db push --force-reset

# 1. Install dependencies
sudo apt install -y nodejs npm

npm install

# 2. Generate Prisma client
npm run prisma:generate

# 3. Push database schema
npm run prisma:push

# 4. Start the app
npm run dev

# Kill Port
sudo fuser -k 9002/tcp


# Database Setup (VPS)
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE quickdesk TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "GRANT ALL ON SCHEMA public TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO quickdesk;"


# Edit pg_hba.conf
sudo nano /etc/postgresql/17/main/pg_hba.conf

# Add this line (replace with correct PostgreSQL version if different):
# Add BEFORE the "local" lines, near the end of the file:
host    all    quickdesk    180.190.223.104/32    md5

# Or to allow from any IP (less secure, for testing):
host    all    all    0.0.0.0/0    md5

# Save and exit (Ctrl+X, Y, Enter)

# Restart PostgreSQL
sudo systemctl restart postgresql
