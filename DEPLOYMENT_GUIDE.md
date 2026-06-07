# Complete Deployment Guide - Project Planner Web App

## Step-by-Step Instructions to Deploy to Netlify with Git

This guide will walk you through setting up Git, connecting to Netlify, and deploying your web app.

---

## Prerequisites

Before starting, make sure you have:
- ✅ Node.js 18+ installed ([Download](https://nodejs.org/))
- ✅ Git installed ([Download](https://git-scm.com/))
- ✅ A GitHub account ([Sign up](https://github.com/))
- ✅ A Netlify account ([Sign up](https://netlify.com))
- ✅ Firebase project configured

---

## Part 1: Initial Setup (One Time)

### Step 1: Install Dependencies

1. **Open Terminal** (on Mac: Applications → Utilities → Terminal)

2. **Navigate to the web-app folder:**
   ```bash
   cd "/Users/farnienel/Desktop/Project Planner/web-app"
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```
   
   This will take 2-3 minutes. Wait for it to complete.

### Step 2: Set Up Environment Variables

1. **Create `.env.local` file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Open `.env.local` in a text editor** and fill in your Firebase config:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-planner-f986c.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-planner-f986c
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-planner-f986c.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980527300983
   NEXT_PUBLIC_FIREBASE_APP_ID=1:980527300983:web:89bd0c7a69881d1b1be172
   ```

3. **Save the file**

### Step 3: Test Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   - Go to `http://localhost:3000`
   - You should see the login page

3. **Stop the server:**
   - Press `Ctrl + C` in terminal

---

## Part 2: Set Up Git (One Time)

### Step 4: Initialize Git Repository

1. **In Terminal, make sure you're in the web-app folder:**
   ```bash
   cd "/Users/farnienel/Desktop/Project Planner/web-app"
   ```

2. **Initialize Git:**
   ```bash
   git init
   ```

3. **Add all files:**
   ```bash
   git add .
   ```

4. **Create first commit:**
   ```bash
   git commit -m "Initial commit - Project Planner web app"
   ```

### Step 5: Create GitHub Repository

1. **Go to GitHub:**
   - Visit [github.com](https://github.com)
   - Sign in (or create account)

2. **Create new repository:**
   - Click the **"+"** icon (top right)
   - Select **"New repository"**
   - Repository name: `project-planner-web`
   - Description: "Desktop web version of Project Planner"
   - Choose **Public** or **Private**
   - **DO NOT** initialize with README, .gitignore, or license
   - Click **"Create repository"**

3. **Copy the repository URL:**
   - You'll see a page with instructions
   - Copy the URL (looks like: `https://github.com/yourusername/project-planner-web.git`)

### Step 6: Connect Local Repository to GitHub

1. **In Terminal, add the remote:**
   ```bash
   git remote add origin https://github.com/yourusername/project-planner-web.git
   ```
   (Replace `yourusername` with your actual GitHub username)

2. **Push to GitHub:**
   ```bash
   git branch -M main
   git push -u origin main
   ```

3. **Enter GitHub credentials when prompted:**
   - Username: Your GitHub username
   - Password: Use a **Personal Access Token** (not your password)
     - Go to GitHub → Settings → Developer settings → Personal access tokens
     - Generate new token with `repo` permissions
     - Use that token as password

---

## Part 3: Deploy to Netlify (One Time Setup)

### Step 7: Connect Netlify to GitHub

1. **Go to Netlify:**
   - Visit [app.netlify.com](https://app.netlify.com)
   - Sign in (or create account)

2. **Add new site:**
   - Click **"Add new site"** button
   - Select **"Import an existing project"**

3. **Connect to Git provider:**
   - Click **"GitHub"** (or GitLab/Bitbucket)
   - Authorize Netlify to access your repositories
   - You may need to enter your GitHub password/token

4. **Select repository:**
   - Find `project-planner-web` in the list
   - Click on it

### Step 8: Configure Build Settings

Netlify should **auto-detect** Next.js, but verify:

1. **Build settings should show:**
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node version:** 18 (or latest LTS)

2. **If not auto-detected, set manually:**
   - Click **"Show advanced"**
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Click "Deploy site"**

### Step 9: Add Environment Variables

1. **While deployment is running, add environment variables:**
   - Go to **Site settings** → **Environment variables**
   - Click **"Add variable"**

2. **Add each Firebase config variable:**
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = project-planner-f986c.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID = project-planner-f986c
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = project-planner-f986c.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 980527300983
   NEXT_PUBLIC_FIREBASE_APP_ID = 1:980527300983:web:89bd0c7a69881d1b1be172
   ```

3. **Click "Save"** after adding each one

4. **Redeploy:**
   - Go to **Deploys** tab
   - Click **"Trigger deploy"** → **"Clear cache and deploy site"**

### Step 10: Wait for Deployment

1. **Watch the deployment:**
   - Netlify will show build progress
   - Takes 2-5 minutes
   - You'll see logs in real-time

2. **When complete:**
   - Status changes to **"Published"**
   - You'll get a URL like: `https://random-name-123.netlify.app`

3. **Test your site:**
   - Visit the URL
   - You should see the login page!

---

## Part 4: Set Up Custom Domain (Optional)

### Step 11: Connect Custom Domain

1. **In Netlify dashboard:**
   - Go to your site
   - Click **"Domain settings"**
   - Click **"Add custom domain"**

2. **Enter domain:**
   - Type: `projectplanner.us`
   - Click **"Verify"**

3. **Update DNS (in Namecheap):**
   - Netlify will show DNS records to add
   - Go to Namecheap → Domain List → projectplanner.us → Manage → Advanced DNS
   - Add the A records Netlify provides
   - Wait for DNS propagation (1-24 hours)

4. **SSL Certificate:**
   - Netlify automatically sets up HTTPS
   - Wait for certificate provisioning (usually automatic)

---

## Part 5: Future Updates (Automatic!)

### How to Update the Website

**Every time you make changes:**

1. **Edit files** in your code editor

2. **Test locally** (optional):
   ```bash
   npm run dev
   ```

3. **Commit and push:**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

4. **That's it!**
   - Netlify automatically detects the push
   - Builds your app
   - Deploys it
   - Updates your live website
   - Takes 2-5 minutes

**No need to go to Netlify dashboard!**

---

## Troubleshooting

### ❌ Build Failed

**Check:**
1. Environment variables are set correctly in Netlify
2. `package.json` has correct build script
3. Check build logs in Netlify dashboard for specific errors

**Fix:**
- Fix the error in your code
- Push again: `git add . && git commit -m "Fix" && git push`

### ❌ "Module not found" Error

**Solution:**
- Make sure all dependencies are in `package.json`
- Run `npm install` locally to test
- Push again

### ❌ Environment Variables Not Working

**Solution:**
- Make sure variables start with `NEXT_PUBLIC_` for client-side
- Redeploy after adding variables
- Check variable names match exactly

### ❌ Can't Push to GitHub

**Solution:**
- Check you're authenticated: `git config --global user.name "Your Name"`
- Use Personal Access Token instead of password
- Make sure repository exists on GitHub

---

## Quick Reference Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production

# Git
git add .            # Stage changes
git commit -m "msg"  # Commit changes
git push             # Push to GitHub

# All in one (after making changes)
git add . && git commit -m "Updated feature" && git push
```

---

## Summary

### Initial Setup (One Time):
1. ✅ Install dependencies (`npm install`)
2. ✅ Set up `.env.local` with Firebase config
3. ✅ Initialize Git (`git init`)
4. ✅ Create GitHub repository
5. ✅ Push to GitHub
6. ✅ Connect to Netlify
7. ✅ Add environment variables
8. ✅ Deploy!

### Future Updates:
1. ✅ Edit code
2. ✅ `git add . && git commit -m "message" && git push`
3. ✅ Wait 2-5 minutes
4. ✅ Website updates automatically!

**That's it! Once set up, updates are automatic!** 🎉

---

## Need Help?

- **Git issues:** Check [Git documentation](https://git-scm.com/doc)
- **Netlify issues:** Check [Netlify docs](https://docs.netlify.com/)
- **Next.js issues:** Check [Next.js docs](https://nextjs.org/docs)

Your web app is now ready to deploy! 🚀




