# 🔧 Install Git First - Then Deploy

## ❌ Error You're Seeing

```
git : O termo 'git' não é reconhecido como nome de cmdlet...
```

**This means**: Git is not installed on your computer.

---

## ✅ Solution: Install Git (5 minutes)

### Step 1: Download Git

**Go to**: https://git-scm.com/download/win

**Or direct link**: https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe

### Step 2: Install Git

1. **Run the downloaded installer**
2. **Installation options** (use these settings):
   - ✅ Select "Git from the command line and also from 3rd-party software"
   - ✅ Use default text editor (Vim or your preference)
   - ✅ Let Git decide default branch name (main)
   - ✅ Use recommended settings for everything else
   - ✅ Click "Next" through the installation
   - ✅ Click "Install"
3. **Finish installation**
4. **IMPORTANT**: Close and reopen PowerShell after installation!

### Step 3: Verify Installation

**Open a NEW PowerShell window** and run:

```powershell
git --version
```

**Should show**: `git version 2.45.x` or similar ✅

---

## 🚀 After Git is Installed

### Then Follow Deployment Steps

**Open**: `QUICK_DEPLOY.md`

**Or run these commands** (in death-tracker folder):

```powershell
# 1. Initialize Git
git init

# 2. Configure Git (replace with YOUR info)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 3. Add all files
git add .

# 4. Create first commit
git commit -m "Initial commit - RubinOT Death Tracker"

# 5. Add GitHub remote (create repo on github.com/new first)
git remote add origin https://github.com/YOUR_USERNAME/rubinot-death-tracker.git

# 6. Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🎯 Complete Workflow

### 1. Install Git
- Download from: https://git-scm.com/download/win
- Install with default settings
- **Close and reopen PowerShell**

### 2. Create GitHub Repository
- Go to: https://github.com/new
- Name: `rubinot-death-tracker`
- Make it Public
- Click "Create repository"
- Copy the repository URL

### 3. Initialize and Push
```powershell
cd C:\xampp\htdocs\death-tracker

git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit"
git remote add origin <paste-your-github-url-here>
git branch -M main
git push -u origin main
```

### 4. Deploy on Netlify
- Go to: https://app.netlify.com/
- Sign up with GitHub
- Import your repository
- Build command: `npm run build`
- Publish directory: `dist`
- Click "Deploy"

---

## ⚠️ Important Notes

### After Installing Git:
- ✅ **MUST close PowerShell** and open a new one
- ✅ This refreshes the PATH variable
- ✅ Then git commands will work

### PowerShell Location:
Make sure you're in the correct folder:
```powershell
cd C:\xampp\htdocs\death-tracker
```

Then run git commands.

---

## 🆘 Alternative: Use Netlify Drag & Drop

### If you don't want to use Git:

**Simplest method (but no auto-updates):**

1. Go to: https://app.netlify.com/drop
2. Drag the entire `dist` folder onto the page
3. Your site deploys instantly!

**Downsides**:
- ❌ No automatic updates (must re-upload manually)
- ❌ No version history
- ❌ No rollback capability

**Upsides**:
- ✅ No Git needed
- ✅ Instant deployment
- ✅ Super simple

**But we recommend Git** for automatic updates! Just install it first.

---

## 📋 Quick Checklist

- [ ] Download Git from: https://git-scm.com/download/win
- [ ] Install Git (default options)
- [ ] **Close PowerShell**
- [ ] **Open NEW PowerShell**
- [ ] Navigate to: `C:\xampp\htdocs\death-tracker`
- [ ] Run: `git --version` (should work now)
- [ ] Follow deployment steps in `QUICK_DEPLOY.md`

---

## 🎯 Summary

**Your error**: Git not installed
**Solution**: Install Git from link above
**After installation**: Close/reopen PowerShell, then continue with deployment

**Download Git here**: https://git-scm.com/download/win

**After Git is installed, open `QUICK_DEPLOY.md` and follow the steps!** 🚀

---

**Good luck!** ✨

