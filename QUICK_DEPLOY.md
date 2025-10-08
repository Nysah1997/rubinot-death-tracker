# ⚡ Quick Deploy Guide - Copy & Paste Commands

## 🎯 GitHub + Netlify = Auto-Deploy Forever!

**Yes! Updates are automatic:**
- Make changes → `git push` → Netlify auto-deploys in 2 min ✅
- No manual reuploading ever needed
- Every commit triggers automatic deployment

---

## 📝 Prerequisites

1. **Install Git**: https://git-scm.com/download/win
2. **GitHub Account**: https://github.com/signup (if you don't have one)
3. **Netlify Account**: https://app.netlify.com/ (sign up with GitHub)

---

## 🚀 Deployment Steps (Copy & Paste)

### Step 1: Create GitHub Repository

1. Go to: **https://github.com/new**
2. Repository name: `rubinot-death-tracker`
3. Make it **Public**
4. **Don't** add README or .gitignore
5. Click **Create repository**
6. **Copy the repository URL** shown on the next page

### Step 2: Initialize Git & Push (PowerShell Commands)

**Open PowerShell in `death-tracker` folder and run these commands:**

```powershell
# 1. Initialize Git
git init

# 2. Configure Git (replace with YOUR info)
git config user.name "YourName"
git config user.email "your.email@example.com"

# 3. Add all files
git add .

# 4. Create first commit
git commit -m "Initial commit - RubinOT Death Tracker"

# 5. Add GitHub as remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 6. Push to GitHub
git branch -M main
git push -u origin main
```

**Example (replace with your info):**
```powershell
git remote add origin https://github.com/john-doe/rubinot-death-tracker.git
```

### Step 3: Deploy on Netlify

1. Go to: **https://app.netlify.com/**
2. Click **"Add new site"** → **"Import an existing project"**
3. Click **"Deploy with GitHub"**
4. Authorize Netlify (if asked)
5. Find and select: `rubinot-death-tracker`
6. Build settings (should auto-detect, but verify):
   ```
   Build command: npm run build
   Publish directory: dist
   Functions directory: netlify/functions
   ```
7. Click **"Deploy site"**
8. Wait 2-3 minutes
9. **Done!** Your site is live! 🎉

---

## 🔄 How to Push Updates (Forever!)

**Every time you make changes:**

```powershell
# 1. Make your code changes
# (edit files in VS Code or any editor)

# 2. Check what changed
git status

# 3. Add changes
git add .

# 4. Commit with message
git commit -m "Description of what you changed"

# 5. Push to GitHub
git push

# 6. Wait ~2 minutes
# Netlify automatically rebuilds and deploys!
# Check your live site - changes are live! ✅
```

**That's it! No reuploading, no manual steps!**

---

## 📧 You'll Get Email Notifications

**Every deployment:**
- ✅ "Deploy started" email
- ✅ "Deploy succeeded" email (or failed, with logs)
- ✅ Direct link to your updated site

---

## 🎯 Example: Making Updates

### Change 1: Update Default Level Filter

```powershell
# Edit src/App.jsx - change default level
# Save the file

git add .
git commit -m "Change default level filter to 100"
git push

# Wait 2 min → Live on your site! ✅
```

### Change 2: Add New Server

```powershell
# Edit src/App.jsx - add server to SERVERS array
# Save the file

git add .
git commit -m "Add new server: XYZ"
git push

# Wait 2 min → Live on your site! ✅
```

### Change 3: Update Styling

```powershell
# Edit src/index.css - change colors, sizes, etc.
# Save the file

git add .
git commit -m "Update card styling"
git push

# Wait 2 min → Live on your site! ✅
```

---

## 🔍 Viewing Your Site

**After first deployment:**
- Netlify gives you URL: `https://random-name.netlify.app`

**To customize:**
1. Netlify Dashboard → Site settings
2. Domain management → Options → Edit site name
3. Change to: `rubinot-tracker.netlify.app`
4. Done! New URL is live

---

## 📊 Deployment Timeline

```
Make changes locally
    ↓
git add . && git commit && git push
    ↓ (seconds)
GitHub receives push
    ↓ (seconds)
Netlify detects change
    ↓ (30 seconds)
Netlify builds project
    ↓ (1-2 minutes)
Netlify deploys
    ↓
✅ Live site updated!

Total: ~2-3 minutes from push to live
```

---

## 🎁 Bonus Features

### Deploy Previews
- Every pull request gets a preview URL
- Test changes before merging
- Share preview with others

### Rollback
- Made a mistake? Rollback to previous deploy
- Netlify Dashboard → Deploys → Click old deploy → "Publish deploy"
- Instant rollback!

### Build Logs
- See exactly what Netlify is doing
- Debug build errors
- Monitor function performance

---

## ⚠️ Important Notes

### What Gets Committed:
✅ Source code (`src/`)
✅ Images (`img/`)
✅ Functions (`netlify/functions/`)
✅ Config files (`package.json`, `netlify.toml`)

### What Doesn't Get Committed (.gitignore):
❌ `node_modules/` (300 MB) - Netlify installs fresh
❌ `dist/` (11 MB) - Netlify builds fresh
❌ `.netlify/` - Local dev cache

**This keeps your repository small (~12 MB) and fast to clone/push!**

---

## 🚀 Complete Command List

### First-Time Setup

```powershell
# Install Git (if needed)
# Download from: https://git-scm.com/download/win

# Create GitHub repo (on website)
# https://github.com/new

# In death-tracker folder:
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit - RubinOT Death Tracker"
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main

# Connect on Netlify (on website)
# https://app.netlify.com/
# Import from GitHub → Select repo → Deploy
```

### Every Update After

```powershell
# Make your changes

git add .
git commit -m "Description of changes"
git push

# Done! Netlify auto-deploys in ~2 minutes
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Site loads at your Netlify URL
- [ ] Deaths appear (default server: Tormentum)
- [ ] Character data shows (vocation, residence, guild)
- [ ] Filters work (level, VIP)
- [ ] Server switching works
- [ ] Copy button works
- [ ] Countdown timer updates
- [ ] Animations are smooth

---

## 🎉 You're Ready!

**Summary:**
1. ✅ Create GitHub repo
2. ✅ Push your code
3. ✅ Connect to Netlify
4. ✅ Deploy automatically

**Future updates:**
- Just `git push` and Netlify handles the rest!
- No manual reuploading
- No configuration changes needed
- Works forever! 🚀

**Deploy now and enjoy automatic updates!** ✨

---

## 📞 Need Help?

If you get stuck:
1. Check the error message
2. Review Netlify build logs
3. Make sure Git is installed
4. Verify GitHub repository was created
5. Check that you replaced YOUR_USERNAME in commands

**Most common issue**: Forgetting to replace placeholders (YOUR_USERNAME, YOUR_EMAIL, etc.) with actual values!

**Good luck with your deployment!** 🎉

