# 🚀 Deploy to Netlify via GitHub - Step by Step

## ✨ Benefits of GitHub + Netlify

### Automatic Updates! 🎉
- ✅ **Push updates** → Netlify automatically rebuilds and deploys
- ✅ **No manual reuploading** needed
- ✅ **Instant deployment** on every commit
- ✅ **Rollback capability** if something goes wrong
- ✅ **Preview deployments** for testing

**Example workflow:**
```
1. Make changes to code
2. git add .
3. git commit -m "Update filters"
4. git push
5. Netlify automatically deploys in ~2 minutes ✅
```

---

## 📋 Prerequisites

### 1. Install Git (if not installed)
- Download: https://git-scm.com/download/win
- Install with default options
- Restart your terminal after installation

### 2. Create GitHub Account (if you don't have one)
- Go to: https://github.com/signup
- Create your account
- Verify your email

### 3. Create New Repository on GitHub
1. Go to: https://github.com/new
2. Repository name: `rubinot-death-tracker` (or any name you like)
3. Description: "Real-time death tracker for RubinOT servers"
4. **Privacy**: 
   - ✅ **Public** (recommended - free Netlify hosting)
   - Or **Private** (if you have Netlify Pro)
5. **Don't** check "Add README" or ".gitignore" (we already have them!)
6. Click **"Create repository"**

---

## 🔧 Step-by-Step Deployment

### Step 1: Initialize Git Locally

Open PowerShell in your `death-tracker` folder and run:

```powershell
# Initialize Git repository
git init

# Configure your name and email (first time only)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Step 2: Add Files to Git

```powershell
# Add all files (node_modules auto-excluded by .gitignore)
git add .

# Check what will be committed
git status
# Should show: src/, img/, netlify/, package.json, etc.
# Should NOT show: node_modules/, dist/

# Commit the files
git commit -m "Initial commit - RubinOT Death Tracker"
```

### Step 3: Connect to GitHub

**After creating your GitHub repository, GitHub will show you commands like:**

```powershell
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/rubinot-death-tracker.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

### Step 4: Connect to Netlify

1. Go to: https://app.netlify.com/
2. Sign up or login (use GitHub account for easier integration)
3. Click **"Add new site"** → **"Import an existing project"**
4. Click **"Deploy with GitHub"**
5. Authorize Netlify to access GitHub (if asked)
6. Select your repository: `rubinot-death-tracker`
7. Configure build settings:
   ```
   Build command: npm run build
   Publish directory: dist
   Functions directory: netlify/functions
   ```
8. Click **"Deploy site"**

### Step 5: Wait for Deployment

**Netlify will:**
1. Clone your repository
2. Run `npm install` (creates node_modules)
3. Run `npm run build` (creates dist)
4. Deploy the dist folder
5. Set up the serverless functions

**Time**: ~2-3 minutes for first deployment

### Step 6: Get Your Live URL

After deployment completes:
- You'll get a URL like: `https://random-name-123.netlify.app`
- You can change it: Site settings → Domain management → Edit site name
- Example: `https://rubinot-tracker.netlify.app`

---

## 🔄 How to Push Updates (After Initial Deploy)

### Make Changes Locally

```powershell
# Edit your files (e.g., change filters, update UI, etc.)

# Check what changed
git status

# Add changed files
git add .

# Commit with a message
git commit -m "Add new feature: X"

# Push to GitHub
git push
```

### Automatic Deployment

**Netlify automatically:**
1. Detects your push to GitHub
2. Starts building within seconds
3. Runs `npm install` and `npm run build`
4. Deploys the new version
5. Your site updates in ~2-3 minutes

**You'll see:**
- Email notification when deploy starts
- Email notification when deploy completes
- Real-time logs in Netlify dashboard

---

## 📊 Deployment Dashboard

### Netlify Dashboard Shows:

**Deploys Tab**:
- All deployments (with commits)
- Build logs
- Deploy preview
- Rollback option

**Functions Tab**:
- Function logs
- Execution time
- Error logs

**Site Settings**:
- Domain management
- Environment variables (if needed)
- Build settings

---

## 🔄 Example Update Workflow

### Scenario: You want to change minimum level filter

```powershell
# 1. Edit src/App.jsx
# (make your changes)

# 2. Test locally
npm run dev
# Verify it works

# 3. Build to check for errors
npm run build
# Should build successfully

# 4. Commit and push
git add .
git commit -m "Update minimum level filter default"
git push

# 5. Wait ~2 minutes
# Netlify automatically rebuilds and deploys!
# Check your live site - changes are live ✅
```

---

## 🎯 Common Commands

### Daily Development

```powershell
# Make changes
# ...

# See what changed
git status

# Add and commit
git add .
git commit -m "Describe your changes"

# Push to GitHub (triggers auto-deploy)
git push
```

### Check Deployment Status

```powershell
# Install Netlify CLI (optional, for status checking)
npm install -g netlify-cli

# Login
netlify login

# Check status
netlify status

# View logs
netlify logs
```

---

## 🛠️ Troubleshooting

### Build Fails on Netlify

**Check:**
1. Netlify build logs (Deploys tab)
2. Make sure `package.json` has all dependencies
3. Try building locally: `npm run build`

**Common issues:**
- Missing dependency: Add to `package.json`
- Build error: Check logs for details
- Timeout: Netlify functions timeout at 10s (ours is ~3-8s, should be fine)

### Deployment Not Triggering

**Check:**
1. Is GitHub connected to Netlify?
2. Did you push to the correct branch (main)?
3. Check Netlify dashboard → Deploys

**Fix:**
- Go to Site settings → Build & deploy → Continuous deployment
- Make sure "Auto publishing" is enabled

### Wrong Domain

**Change your domain:**
1. Site settings → Domain management
2. Edit site name: `your-custom-name.netlify.app`
3. Or add custom domain (requires DNS setup)

---

## ✅ Quick Start Checklist

- [ ] Git installed
- [ ] GitHub account created
- [ ] GitHub repository created
- [ ] Git initialized locally (`git init`)
- [ ] Files committed (`git add . && git commit`)
- [ ] Pushed to GitHub (`git push`)
- [ ] Netlify account created
- [ ] Repository imported on Netlify
- [ ] Build settings configured
- [ ] Deployed successfully
- [ ] Site URL working

---

## 🎉 After Deployment

### Your site will be live at:
`https://your-site-name.netlify.app`

### Future updates:
```
Edit code → git add . → git commit → git push → Auto-deploy! ✅
```

**No reuploading, no manual building - just push and it deploys!** 🚀

---

## 📞 Need Help?

### Netlify Support:
- Docs: https://docs.netlify.com/
- Community: https://answers.netlify.com/
- Status: https://www.netlifystatus.com/

### Your Project:
- Check function logs in Netlify dashboard
- Monitor build logs for errors
- Use deploy previews for testing

---

**You're all set! Follow the steps above and your death tracker will be live with automatic deployments!** ✨

