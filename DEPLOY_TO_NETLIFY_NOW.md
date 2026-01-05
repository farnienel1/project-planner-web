# Deploy to Netlify - Quick Guide

## Current Status

✅ **Web app is ready!**  
❌ **Not deployed yet** - Let's deploy it now!

---

## Quick Deployment Steps

### Option 1: Deploy via Git (Recommended - Automatic Updates)

This connects your code to GitHub and Netlify, so future updates are automatic.

#### Step 1: Initialize Git (If Not Done)

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git init
git add .
git commit -m "Initial commit - Project Planner web app"
```

#### Step 2: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click **"+"** → **"New repository"**
3. Name: `project-planner-web`
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README
6. Click **"Create repository"**

#### Step 3: Push to GitHub

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
git branch -M main
git push -u origin main
```

(Replace `YOUR_USERNAME` with your GitHub username)

#### Step 4: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub**
4. Authorize Netlify
5. Select `project-planner-web` repository
6. Netlify auto-detects Next.js!
7. Click **"Deploy site"**

#### Step 5: Add Environment Variables

1. In Netlify → Your site → **Site settings** → **Environment variables**
2. Add each variable:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = project-planner-f986c.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID = project-planner-f986c
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = project-planner-f986c.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 980527300983
   NEXT_PUBLIC_FIREBASE_APP_ID = 1:980527300983:web:project-planner
   ```

3. Click **"Redeploy"** after adding variables

#### Step 6: Wait for Deployment

- Takes 2-5 minutes
- You'll see build progress
- When done, you'll get a URL like: `https://random-name-123.netlify.app`

**Done!** 🎉

---

### Option 2: Deploy via Drag & Drop (Quick Test)

**Note:** This doesn't support automatic updates, but it's faster for testing.

#### Step 1: Build the App

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
npm run build
```

#### Step 2: Export as Static

Update `next.config.js` to add:
```javascript
output: 'export',
```

Then rebuild:
```bash
npm run build
```

#### Step 3: Upload to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag the `out` folder onto Netlify
3. Done!

**But this won't have automatic updates - use Option 1 for production!**

---

## Recommended: Use Option 1 (Git)

**Why:**
- ✅ Automatic updates when you push code
- ✅ Full Next.js features
- ✅ Easy to maintain
- ✅ Professional setup

**Time:** ~15 minutes for initial setup  
**After that:** Updates are automatic! (just push to Git)

---

## After Deployment

### Your App Will Be Live At:
- Netlify URL: `https://your-site.netlify.app`
- Or custom domain: `https://projectplanner.us` (if you set it up)

### Data Sync:
- ✅ **Automatic!** Same Firebase backend
- ✅ Projects from iOS app will appear
- ✅ Changes sync in real-time
- ✅ No action needed!

---

## Need Help?

Follow the complete guide: `DEPLOYMENT_GUIDE.md`

Or I can help you step-by-step right now! Just let me know. 🚀
