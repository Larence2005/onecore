#!/bin/bash

# Database Setup Script for Quickdesk PostgreSQL Migration
# This script will create the database and user for the application

set -e

echo "🚀 Quickdesk Database Setup"
echo "============================"
echo ""

# Configuration
DB_NAME="quickdesk"
DB_USER="quickdesk"
DB_PASSWORD="n3K@4nd)3b#g8sa6mNvs$(openssl rand -hex 8)"

echo "📋 Configuration:"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running!"
    echo "   Please start PostgreSQL first:"
    echo "   sudo systemctl start postgresql"
    exit 1
fi

echo "✅ PostgreSQL is running"
echo ""

# Create database and user
echo "🔧 Creating database and user..."

# Try to create as current user first, then fall back to postgres user
if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "⚠️  Database '$DB_NAME' already exists"
else
    if createdb "$DB_NAME" 2>/dev/null; then
        echo "✅ Database '$DB_NAME' created"
    else
        echo "   Trying with postgres user..."
        sudo -u postgres createdb "$DB_NAME" || echo "⚠️  Could not create database (may already exist)"
    fi
fi

# Create user and grant privileges
echo "🔐 Setting up user and permissions..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "⚠️  User may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Add this to your .env file:"
echo "================================"
echo "DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\""
echo ""
echo "🔑 Also add these if not present:"
echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\""
echo "NEXTAUTH_URL=\"http://localhost:9002\""
echo ""
echo "Next steps:"
echo "1. Copy the DATABASE_URL above to your .env file"
echo "2. Run: npm run prisma:push"
echo "3. Run: npm run dev"
echo ""
