# 🚀 Database Setup - Manual Steps Required

## Current Status

✅ **Completed:**
- Dependencies installed
- Prisma client generated
- Environment variables added to .env

⚠️ **Needs Your Action:**
- PostgreSQL database creation (requires sudo)
- Database schema initialization

---

## Step-by-Step Instructions

### Step 1: Create PostgreSQL Database

Run these commands in your terminal (you'll need to enter your sudo password):

```bash
# Create the database
sudo -u postgres createdb quickdesk

# Verify it was created
sudo -u postgres psql -l | grep quickdesk
```

**Expected output:** You should see `quickdesk` in the database list.

---

### Step 2: Set Up Database User (Optional but Recommended)

For better security, create a dedicated user:

```bash
# Create user with password
sudo -u postgres psql -c "CREATE USER quickdesk WITH PASSWORD 'n3K4nd3bg8sa6mNvs';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE quickdesk TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "GRANT ALL ON SCHEMA public TO quickdesk;"
sudo -u postgres psql -d quickdesk -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO quickdesk;"
```

Then update your `.env` file's DATABASE_URL to:
```
DATABASE_URL="postgresql://quickdesk_user:quickdesk_secure_password@localhost:5432/quickdesk"
```

**OR** for simplicity, allow postgres user without password (local only):

```bash
# Edit pg_hba.conf to allow local connections
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Change this line:
# local   all             postgres                                peer
# To:
# local   all             postgres                                trust

# Restart PostgreSQL
sudo systemctl restart postgresql
```

Then your current DATABASE_URL will work:
```
DATABASE_URL="postgresql://postgres@localhost:5432/quickdesk"
```

---

### Step 3: Initialize Database Schema

Once the database is created, run:

```bash
npm run prisma:push
```

This will create all the tables, indexes, and relationships.

**Expected output:**
```
✔ Generated Prisma Client
🚀 Your database is now in sync with your Prisma schema.
```

---

### Step 4: Verify Setup

Open Prisma Studio to view your database:

```bash
npm run prisma:studio
```

This will open a browser window at `http://localhost:5555` where you can see all your tables.

---

### Step 5: Test the Application

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:9002` and try to sign up with a new account!

---

## Quick Reference Commands

```bash
# Check if PostgreSQL is running
pg_isready

# Create database (run this first!)
sudo -u postgres createdb quickdesk

# Push schema to database
npm run prisma:push

# View database
npm run prisma:studio

# Start app
npm run dev
```

---

## Troubleshooting

### "Database quickdesk does not exist"
```bash
sudo -u postgres createdb quickdesk
```

### "Authentication failed"
Update your DATABASE_URL in `.env` or configure PostgreSQL to allow local connections (see Step 2).

### "Permission denied"
```bash
sudo -u postgres psql -d quickdesk -c "GRANT ALL ON SCHEMA public TO quickdesk_user;"
```

### "Can't reach database server"
```bash
sudo systemctl start postgresql
```

---

## What's in Your .env File

I've added these variables to your `.env`:

```env
DATABASE_URL="postgresql://postgres@localhost:5432/quickdesk"
NEXTAUTH_SECRET="klGBo73giiBRIRIrTMd7U0Znsjsc/SywsNAUk9LD8PE="
NEXTAUTH_URL="http://localhost:9002"
```

---

## Next Phase

Once you complete these steps and run `npm run prisma:push` successfully, we'll move to:

**Phase 3: Migrate Server Actions** - Converting the 2,822 lines of Firestore code in `src/app/actions.ts` to use Prisma.

---

## Need Help?

If you encounter any issues, let me know and I'll help troubleshoot!
