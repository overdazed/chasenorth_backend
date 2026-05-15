## Step-by-Step Railway Backend Deployment

### Step 1: Prepare Your Repository
Make sure these files are committed and pushed to GitHub:
- `backend/` folder with all files
- `railway.toml` (configuration)
- `.env.example` (template)
- Updated `package.json`

### Step 2: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (free, no credit card required)
3. Authorize Railway to access your repositories

### Step 3: Deploy Backend
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your repository: `ChaseNorth_new`
3. Railway will detect it's a Node.js app and start deployment
4. Wait for build to complete (~2-3 minutes)

### Step 4: Configure Environment Variables
In Railway dashboard:
1. Go to your project → **"Variables"** tab
2. Add these variables (copy from your local `.env`):

```
NODE_ENV=production
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=generate_a_secure_random_string
PAYPAL_CLIENT_ID=your_paypal_client_id
COMPANY_NAME=ChaseNorth
COMPANY_EMAIL=shop@chasenorth.com
# ... add all variables from .env.example
```

### Step 5: Set Up MongoDB Atlas
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create free cluster (M0 - Free tier)
3. Create database user and get connection string
4. Add your Railway server IP to MongoDB whitelist (0.0.0.0/0 for testing)

### Step 6: Test Backend Deployment
After deployment, Railway gives you a URL like:
`https://chasenorth-backend.up.railway.app`

Test it:
- Visit: `https://your-url.up.railway.app/api/test`
- Should return: `{"message": "Server is running...", "mongoConnected": true}`

### Step 7: Add Custom Domain (Optional)
1. In Railway: Project → Settings → Domains
2. Add `api.chasenorth.com`
3. Update DNS records to point to Railway

### Step 8: Prepare Frontend for Production
Update your frontend environment variables:

```bash
# In frontend/.env.production
VITE_API_URL=https://your-railway-url.up.railway.app
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
```

### Step 9: Deploy Frontend to Hostinger
1. Build frontend: `npm run build`
2. Upload `frontend/dist/` contents to Hostinger `public_html/`
3. Point `chasenorth.com` to Hostinger

### Common Issues & Solutions

**Railway Build Fails:**
- Check `railway.toml` is in backend folder
- Make sure `package.json` has correct start script
- Check build logs in Railway dashboard

**MongoDB Connection Issues:**
- Verify connection string format
- Add Railway IP to MongoDB whitelist
- Check database user credentials

**Environment Variables:**
- All required variables must be set in Railway dashboard
- Don't commit real secrets to GitHub

### Cost Summary
- **Railway Backend**: FREE (512MB RAM, 1GB storage)
- **MongoDB Atlas**: FREE (M0 tier - 512MB storage)
- **Hostinger Frontend**: ~€2/month
- **Total**: ~€2/month (vs €3.70/month for VPS)

Ready to start with Railway deployment?