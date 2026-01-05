# Deploy to Netlify - Step by Step RIGHT NOW

## ✅ What I Just Did

1. ✅ Initialized Git in web-app folder
2. ✅ Added all files
3. ✅ Created first commit

**Now you need to:**

---

## Step 1: Create GitHub Repository (5 minutes)

1. **Go to:** [github.com](https://github.com)
2. **Sign in** (or create account)
3. **Click:** The **"+"** icon (top right) → **"New repository"**
4. **Repository name:** `project-planner-web`
5. **Description:** "Desktop web version of Project Planner"
6. **Choose:** Public or Private
7. **IMPORTANT:** Do NOT check "Initialize with README"
8. **Click:** "Create repository"

---

## Step 2: Connect Local Code to GitHub (2 minutes)

**In Terminal, run these commands:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

**Example:**
- If your GitHub username is `farnienel`, use:
  ```bash
  git remote add origin https://github.com/farnienel/project-planner-web.git
  ```

**If it asks for credentials:**
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your password)
  - Go to: GitHub → Settings → Developer settings → Personal access tokens
  - Generate new token with `repo` permissions
  - Use that token as the password

---

## Step 3: Connect to Netlify (3 minutes)

1. **Go to:** [app.netlify.com](https://app.netlify.com)
2. **Sign in** (or create account - free)
3. **Click:** "Add new site" button
4. **Click:** "Import an existing project"
5. **Click:** "GitHub" (or GitLab/Bitbucket)
6. **Authorize Netlify** to access your repositories
7. **Find and click:** `project-planner-web` repository
8. **Netlify will auto-detect Next.js!**
9. **Click:** "Deploy site"

---

## Step 4: Add Environment Variables (5 minutes)

**While deployment is running:**

1. **In Netlify dashboard:**
   - Click on your site
   - Go to: **Site settings** → **Environment variables**
   - Click: **"Add variable"**

2. **Add these 6 variables one by one:**

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY
   Value: AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
   ```

   ```
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   Value: project-planner-f986c.firebaseapp.com
   ```

   ```
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   Value: project-planner-f986c
   ```

   ```
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   Value: project-planner-f986c.appspot.com
   ```

   ```
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   Value: 980527300983
   ```

   ```
   NEXT_PUBLIC_FIREBASE_APP_ID
   Value: 1:980527300983:web:project-planner
   ```

3. **After adding all variables:**
   - Go to: **Deploys** tab
   - Click: **"Trigger deploy"** → **"Clear cache and deploy site"**

---

## Step 5: Wait for Deployment (2-5 minutes)

- Watch the build progress
- You'll see logs in real-time
- When done: Status changes to **"Published"**
- You'll get a URL like: `https://random-name-123.netlify.app`

---

## Step 6: Test Your Live Site! 🎉

1. **Visit your Netlify URL**
2. **You should see:**
   - Login page
   - Can log in with your Firebase credentials
   - Dashboard with all features
   - Projects, Operatives, Managers, Schedule, Small Works!

---

## ✅ After Deployment

### Your App is Live!
- **URL:** `https://your-site.netlify.app`
- **Data:** Automatically synced from iOS app (same Firebase!)
- **Updates:** Automatic when you push to Git!

### Future Updates

**Every time you make changes:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git add .
git commit -m "Description of changes"
git push
```

**Netlify automatically:**
- Detects the push
- Builds your app
- Deploys it
- Updates your live site!

**Takes 2-5 minutes, completely automatic!** 🚀

---

## Quick Summary

**Right now:**
1. ✅ Git initialized
2. ✅ Files committed
3. ⚠️ Need to: Create GitHub repo
4. ⚠️ Need to: Push to GitHub
5. ⚠️ Need to: Connect to Netlify
6. ⚠️ Need to: Add environment variables

**Total time:** ~15 minutes  
**After that:** Updates are automatic!

---

## Need Help?

Tell me:
1. **Do you have a GitHub account?** (If not, create one at github.com)
2. **What's your GitHub username?** (I can help with the exact commands)
3. **Do you have a Netlify account?** (If not, create one at netlify.com)

I can guide you through each step! 🚀
