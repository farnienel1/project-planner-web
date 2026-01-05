# Quick Deploy to Netlify - Step by Step

## 🚀 Deploy Your Web App in 15 Minutes!

---

## Step 1: Set Up Git (5 minutes)

### 1.1: Initialize Git

**In Terminal, run these commands:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git init
git add .
git commit -m "Initial commit - Project Planner web app"
```

### 1.2: Create GitHub Repository

1. **Go to:** [github.com](https://github.com)
2. **Sign in** (or create account)
3. **Click:** The **"+"** icon (top right) → **"New repository"**
4. **Repository name:** `project-planner-web`
5. **Description:** "Desktop web version of Project Planner"
6. **Choose:** Public or Private
7. **DO NOT** check "Initialize with README"
8. **Click:** "Create repository"

### 1.3: Connect Local to GitHub

**Copy the commands GitHub shows you** (they'll look like this):

```bash
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username**

**Run these commands in Terminal** (you'll need to enter your GitHub username and password/token)

---

## Step 2: Connect to Netlify (5 minutes)

### 2.1: Go to Netlify

1. **Visit:** [app.netlify.com](https://app.netlify.com)
2. **Sign in** (or create account - use GitHub to sign in for easiest setup)

### 2.2: Import Project

1. **Click:** "Add new site" → "Import an existing project"
2. **Click:** "GitHub" (or GitLab/Bitbucket)
3. **Authorize** Netlify to access your repositories
4. **Select:** `project-planner-web` repository

### 2.3: Configure Build

Netlify should **auto-detect** Next.js! Verify:

- **Build command:** `npm run build` ✅
- **Publish directory:** `.next` ✅
- **Node version:** 18 (or latest) ✅

**Click:** "Deploy site"

---

## Step 3: Add Environment Variables (3 minutes)

### 3.1: While Deployment Runs

1. **Go to:** Site settings → **Environment variables**
2. **Click:** "Add variable"

### 3.2: Add Each Variable

Add these **6 environment variables**:

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = project-planner-f986c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = project-planner-f986c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = project-planner-f986c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 980527300983
NEXT_PUBLIC_FIREBASE_APP_ID = 1:980527300983:web:project-planner
```

**Click "Save" after each one**

### 3.3: Redeploy

1. **Go to:** Deploys tab
2. **Click:** "Trigger deploy" → "Clear cache and deploy site"
3. **Wait** 2-5 minutes for build

---

## Step 4: Your Site is Live! (2 minutes)

1. **Wait** for deployment to complete
2. **Visit** your Netlify URL (like: `https://random-name-123.netlify.app`)
3. **Test** the login page
4. **Login** with your Firebase credentials
5. **See** your data! 🎉

---

## Step 5: Set Up Custom Domain (Optional)

1. **In Netlify:** Site settings → Domain settings
2. **Click:** "Add custom domain"
3. **Enter:** `projectplanner.us`
4. **Follow** Netlify's DNS instructions
5. **Add** DNS records in Namecheap
6. **Wait** for DNS propagation

---

## ✅ What Happens After Deployment

### Data Sync: ✅ AUTOMATIC!

- ✅ Your iOS app data will appear in the web app
- ✅ Changes in web app appear in iOS app
- ✅ Same Firebase backend = automatic sync!

### Future Updates: ✅ AUTOMATIC!

**Every time you make changes:**

1. **Edit code**
2. **Push to Git:**
   ```bash
   git add .
   git commit -m "Updated feature"
   git push
   ```
3. **Wait 2-5 minutes**
4. **Website updates automatically!** 🎉

---

## 🆘 Troubleshooting

### Build Failed?
- Check environment variables are set correctly
- Check build logs in Netlify dashboard
- Make sure all dependencies are in `package.json`

### Can't Push to GitHub?
- Use Personal Access Token instead of password
- Check you're authenticated: `git config --global user.name "Your Name"`

### Site Shows Errors?
- Check environment variables match exactly
- Check Firebase config is correct
- Check Netlify build logs

---

## 📋 Quick Checklist

- [ ] Git initialized
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Netlify connected to GitHub
- [ ] Environment variables added
- [ ] Site deployed successfully
- [ ] Tested login
- [ ] Data appears correctly

---

## Summary

**Time:** ~15 minutes total
**Result:** Your web app live on Netlify! 🚀

**After setup:**
- Updates are automatic (just push to Git)
- Data syncs automatically with iOS app
- Professional, beautiful web app!

**Ready to deploy?** Follow the steps above! 🎉
