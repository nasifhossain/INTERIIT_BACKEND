#!/bin/bash

# 🚀 Quick Deployment Setup Script for Render

echo "🚀 Setting up InterIIT Backend for Render deployment..."

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Ready for Render deployment"
else
    echo "✅ Git repository already initialized"
fi

# Check if package.json has start script
if grep -q '"start"' package.json; then
    echo "✅ Start script found in package.json"
else
    echo "❌ Start script missing in package.json"
    echo "Please add: \"start\": \"node server.js\" to your scripts"
fi

# Check if server.js uses process.env.PORT
if grep -q "process.env.PORT" server.js; then
    echo "✅ Server configured for dynamic PORT"
else
    echo "❌ Server not configured for dynamic PORT"
    echo "Please ensure your server uses: process.env.PORT || 3000"
fi

# Create .env.example for reference
cat > .env.example << EOL
# Environment Variables for Render Deployment

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# JWT Configuration
JWT_SECRET=your-super-secure-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Environment
NODE_ENV=production
EOL

echo "📝 Created .env.example file"

# Check if .gitignore exists and includes common items
if [ ! -f .gitignore ]; then
    cat > .gitignore << EOL
# Dependencies
node_modules/
npm-debug.log*

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Build output
dist/
build/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
EOL
    echo "📝 Created .gitignore file"
else
    echo "✅ .gitignore already exists"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. 📊 Create MongoDB Atlas account (free): https://cloud.mongodb.com"
echo "2. 🌐 Create Render account: https://render.com"
echo "3. 📚 Follow the detailed guide in DEPLOYMENT_GUIDE.md"
echo ""
echo "4. 🔗 Push to GitHub:"
echo "   git remote add origin https://github.com/yourusername/interiit-backend.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "5. 🚀 Deploy on Render using your GitHub repository"
echo ""
echo "💡 Need help? Check DEPLOYMENT_GUIDE.md for detailed instructions!"