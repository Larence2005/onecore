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