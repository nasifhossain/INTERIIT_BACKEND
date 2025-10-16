# 🚀 Deploy to Render - FREE Tier Guide

## Prerequisites ✅
- GitHub repository with your code
- MongoDB Atlas account (free tier)
- Render account (free at render.com)

---

## Step 1: Setup MongoDB Atlas (FREE)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Sign up for free account
   - Create a new project: "InterIIT Backend"

2. **Create Free Database**
   - Click "Build a Database"
   - Choose **FREE tier** (M0 Sandbox)
   - Select AWS/GCP region closest to you
   - Name cluster: `interiit-cluster`

3. **Setup Database Access**
   - Go to "Database Access"
   - Add new user: `interiit-user`
   - Set password (save it!)
   - Give "Read and write to any database" permission

4. **Setup Network Access**
   - Go to "Network Access"
   - Add IP Address: `0.0.0.0/0` (allow all - for Render)

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your user password
   - Replace `<dbname>` with `interiit_db`

---

## Step 2: Push Code to GitHub

1. **Initialize Git (if not done)**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub Repository**
   - Go to GitHub and create new repository
   - Add remote and push:
   ```bash
   git remote add origin https://github.com/yourusername/interiit-backend.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 3: Deploy on Render (FREE)

1. **Create Render Account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub account

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your `interiit-backend` repo

3. **Configure Deployment Settings**
   ```
   Name: interiit-backend
   Region: Any (closest to your users)
   Branch: main
   Root Directory: (leave blank)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free
   ```

4. **Add Environment Variables**
   Click "Advanced" and add these:
   ```
   NODE_ENV = production
   MONGODB_URI = mongodb+srv://interiit-user:yourpassword@interiit-cluster.xxxxx.mongodb.net/interiit_db
   JWT_SECRET = your-super-secure-secret-key-minimum-32-characters-long
   JWT_EXPIRES_IN = 7d
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes for deployment
   - Your app will be live at: `https://your-app-name.onrender.com`

---

## Step 4: Test Your Deployment

1. **Health Check**
   ```bash
   curl https://your-app-name.onrender.com/
   ```

2. **Test API Endpoints**
   ```bash
   # Register user
   curl -X POST https://your-app-name.onrender.com/api/users/register \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","email":"test@test.com","password":"password123"}'
   
   # Login
   curl -X POST https://your-app-name.onrender.com/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"password123"}'
   ```

---

## Step 5: Free Tier Limitations & Tips

### Render Free Tier Limits:
- ✅ **750 hours/month** (enough for 24/7)
- ✅ **512MB RAM, 0.1 CPU**
- ✅ **100GB bandwidth/month**
- ⚠️ **App sleeps after 15 min inactivity**
- ⚠️ **Cold start ~30 seconds**

### Keep App Awake (Optional):
```javascript
// Add to your app.js for health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
```

### Use Cron Job to Ping (Free):
- Use [cron-job.org](https://cron-job.org)
- Ping your `/health` endpoint every 10 minutes
- Keeps app awake during business hours

---

## Step 6: Custom Domain (Optional)

1. **In Render Dashboard**
   - Go to your service → Settings
   - Add custom domain: `api.yourdomain.com`

2. **DNS Setup**
   - Add CNAME record in your DNS:
   ```
   api.yourdomain.com → your-app-name.onrender.com
   ```

---

## Environment Variables Reference

```bash
# Required
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=minimum-32-character-secret-key
JWT_EXPIRES_IN=7d

# Optional
LOG_LEVEL=info
```

---

## Troubleshooting

### Common Issues:
1. **Build Fails**: Check package.json has correct start script
2. **App Won't Start**: Verify PORT is not hardcoded
3. **Database Connection**: Check MongoDB URI and network access
4. **JWT Errors**: Ensure JWT_SECRET is 32+ characters

### Checking Logs:
- Go to Render dashboard → Your service → Logs
- Look for startup errors or connection issues

---

## Cost Breakdown (FREE!)

- **Render Web Service**: FREE (750 hrs/month)
- **MongoDB Atlas**: FREE (512MB storage)
- **Total Monthly Cost**: $0.00 💰

---

## Next Steps for Production

When you outgrow free tier:
1. **Render Starter Plan**: $7/month (always on, more resources)
2. **MongoDB Atlas M2**: $9/month (2GB storage, faster)
3. **Custom Domain**: Usually free with DNS provider
4. **CDN**: Consider Cloudflare (free)

---

## Support & Monitoring

### Free Monitoring Tools:
- **Render Dashboard**: Built-in metrics
- **MongoDB Atlas**: Database monitoring
- **UptimeRobot**: External uptime monitoring (free)

### Getting Help:
- Render Community: [community.render.com](https://community.render.com)
- MongoDB Community: [community.mongodb.com](https://community.mongodb.com)

---

**🎉 Congratulations! Your backend is now live and free!**

**Live URL**: `https://your-app-name.onrender.com`