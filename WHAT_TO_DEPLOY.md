# 📦 What to Deploy - Simple Guide

## ✅ Files Already Cleaned Up

**Removed (Not Needed)**:
- ✅ `tailwind.config.js` - DELETED
- ✅ `postcss.config.js` - DELETED  
- ✅ `src/deaths-test.json` - DELETED

## 📁 About node_modules (300MB)

### What is it?
A folder containing all JavaScript libraries (React, Puppeteer, Vite, etc.)

### Do I need it?
- **For local development**: YES (need to run/build)
- **For Netlify deployment**: NO (Netlify installs it automatically)
- **To commit to Git**: NO (excluded by .gitignore)

### What happens on Netlify?
1. You push your code (WITHOUT node_modules)
2. Netlify reads `package.json`
3. Netlify runs `npm install` (creates fresh node_modules)
4. Netlify runs `npm run build`
5. Netlify deploys the result

**You never upload node_modules - Netlify creates it!**

---

## 🚀 Two Ways to Deploy

### Method 1: Using Netlify CLI

**You Upload**: Entire project folder
**Netlify Ignores**: node_modules, dist (per .gitignore)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod

# When asked for deploy path, enter: dist
```

### Method 2: Using Git + Netlify UI (Recommended)

**You Push to Git**: Only source files (~12 MB)
**Netlify Builds**: Fresh on their servers

**Steps:**
1. Install Git: https://git-scm.com/download/win
2. Initialize repository:
   ```bash
   git init
   git add .
   git commit -m "Deploy RubinOT Death Tracker"
   ```
3. Push to GitHub/GitLab
4. Connect on Netlify Dashboard
5. Deploy!

---

## 📊 What Gets Deployed

### Your Repository (What You Push)
```
death-tracker/
├── src/                    ~50 KB    ✅ COMMIT
├── img/                    ~11 MB    ✅ COMMIT
├── netlify/functions/      ~10 KB    ✅ COMMIT
├── package.json            ~1 KB     ✅ COMMIT
├── package-lock.json       ~500 KB   ✅ COMMIT
├── vite.config.js          ~1 KB     ✅ COMMIT
├── netlify.toml            ~1 KB     ✅ COMMIT
├── index.html              ~1 KB     ✅ COMMIT
├── .gitignore              ~1 KB     ✅ COMMIT
├── README.md               ~10 KB    ✅ COMMIT
│
├── node_modules/           300 MB    ❌ DON'T COMMIT (.gitignore)
└── dist/                   ~11 MB    ❌ DON'T COMMIT (.gitignore)
```

**Total to Git**: ~12 MB (manageable!)

### What Netlify Creates
```
On Netlify servers:
├── (Your files from Git)
├── node_modules/          # Netlify installs fresh
└── dist/                  # Netlify builds fresh
```

---

## 🧹 Optional: Clean Up Documentation Files

After you've read the deployment guides, you can delete these (optional):

```bash
# Optional cleanup - delete deployment guides
rm DEPLOY_NOW.md
rm DEPLOYMENT.md
rm DEPLOYMENT_CHECKLIST.md
rm DEPLOYMENT_GUIDE.md
rm FINAL_CHECKLIST.txt
rm WHAT_TO_DEPLOY.md

# Keep only README.md for GitHub
```

**Or keep them** - they're small (~50 KB total) and might be useful later!

---

## 🎯 Simple Answer

### "Do I need node_modules?"

**Locally**: Yes (to build and run)
**On Netlify**: No (Netlify handles it)
**In Git**: No (excluded automatically)

### "What do I deploy?"

**Everything EXCEPT**:
- node_modules/
- dist/
- .netlify/

These are automatically excluded by `.gitignore` ✅

---

## ✨ Quick Deploy Checklist

1. [ ] Build works locally: `npm run build`
2. [ ] Test works locally: `npm run dev`
3. [ ] Push to Git (node_modules automatically excluded)
4. [ ] Import on Netlify
5. [ ] Configure: build=`npm run build`, publish=`dist`
6. [ ] Deploy!

**That's it!** Netlify handles node_modules automatically. 🎉

---

## 💾 Disk Space Management

### Current Usage:
- Source files: ~12 MB
- node_modules: ~300 MB
- dist: ~11 MB
- **Total**: ~323 MB

### To Free Space:
```bash
# Delete node_modules
rm -rf node_modules  # Saves 300 MB

# Delete dist
rm -rf dist  # Saves 11 MB

# Reinstall when needed
npm install  # Recreates node_modules
npm run build  # Recreates dist
```

### For Deployment:
- Git repository: ~12 MB only
- Netlify handles the rest
- No need to worry about 300 MB!

---

**Ready to deploy! 🚀**

