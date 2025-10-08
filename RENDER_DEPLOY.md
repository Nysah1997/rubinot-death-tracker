# 🚀 Deploy to Render.com - Step by Step

## ✅ Code is Ready!

Your code is now configured for Render with:
- ✅ Express server (`server.js`)
- ✅ Full Puppeteer support
- ✅ Render configuration (`render.yaml`)
- ✅ Pushed to GitHub

---

## 📋 Deployment Steps:

### **Step 1: Go to Render**
👉 https://render.com

### **Step 2: Sign Up**
- Click **"Get Started for Free"**
- Choose **"Sign up with GitHub"**
- Authorize Render

### **Step 3: Create New Web Service**
1. Click **"New +"** → **"Web Service"**
2. Click **"Connect account"** (if needed)
3. Find: `sowber/rubinot-death-tracker`
4. Click **"Connect"**

### **Step 4: Configure (Render should auto-detect)**

**Basic Settings:**
- **Name:** `rubinot-death-tracker` (or whatever you want)
- **Environment:** `Node`
- **Region:** Choose closest to you
- **Branch:** `main`

**Build & Deploy:**
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

**Instance Type:**
- Select **"Free"** ✅

### **Step 5: Deploy!**
- Click **"Create Web Service"**
- Wait 5-10 minutes for first build

---

## ⏱️ What to Expect:

### First Deploy:
```
⬥ Cloning repository...
⬥ Installing dependencies...
⬥ Installing Puppeteer (this takes time!)
⬥ Building frontend...
⬥ Starting server...
✓ Live!
```

**Time:** ~5-10 minutes (Puppeteer installation is slow)

---

## 🎉 After Deployment:

You'll get a URL like:
```
https://rubinot-death-tracker.onrender.com
```

### Test Your Site:
- ✅ Deaths should load
- ✅ Character data should show
- ✅ All features working
- ⚠️ First load might be slow (30s) if service was asleep

---

## ⚠️ Important: Free Tier Limitations

### Sleep Behavior:
- **Spins down after 15 minutes** of inactivity
- **Takes ~30 seconds to wake up** on first request
- **Stays awake** while being used

### How to Keep it Awake (Optional):
Use a free monitoring service like:
- UptimeRobot (https://uptimerobot.com)
- Ping every 14 minutes
- Keeps your app always responsive

---

## 🔧 If Build Fails:

### Check Logs:
1. Go to your service dashboard
2. Click "Logs" tab
3. Look for errors

### Common Issues:

**Issue 1: Puppeteer installation timeout**
- **Solution:** Just retry the deploy (it happens sometimes)

**Issue 2: Out of memory**
- **Solution:** Upgrade to paid plan ($7/month)
- Or reduce number of deaths fetched (change 5 to 3 in server.js)

**Issue 3: Port error**
- **Solution:** Should not happen (server.js uses process.env.PORT)

---

## 💰 Cost:

**Free Tier:**
- ✅ 750 hours/month (enough for 24/7)
- ✅ Spins down after inactivity
- ✅ No credit card required

**If you need always-on:**
- Paid plan: $7/month
- No sleep, always fast
- More memory

---

## 🎯 After Going Live:

### Monitor Performance:
- Check Render dashboard for metrics
- Watch memory usage
- Check response times

### If it's slow:
- Cache is working (2 seconds, then instant)
- Character cache is permanent (1 hour)
- Should be fast after first load

---

## 🔄 Auto-Deployments:

Every time you push to GitHub:
```bash
git add .
git commit -m "Your changes"
git push
```

Render automatically:
1. Detects the push
2. Rebuilds your app
3. Deploys new version
4. Zero downtime!

---

## ✅ Success Checklist:

After deployment, verify:
- [ ] Site loads at Render URL
- [ ] Deaths appear within 5 seconds
- [ ] Character data shows (vocation, residence, guild, VIP)
- [ ] Server switching works
- [ ] Filters work
- [ ] Auto-refresh works
- [ ] Images load
- [ ] Copy to clipboard works

---

## 🎉 You're Done!

Your death tracker will be live and working with full Puppeteer support!

**Start deploying:** https://render.com

---

**Good luck!** 🚀

