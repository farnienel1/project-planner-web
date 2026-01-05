# 🔧 Fix Netlify Build Error

## ❌ Error You're Seeing:
```
npm error Missing script: "build"
No config file was defined: using default values
```

## 🔍 Root Cause:
Netlify isn't finding your `netlify.toml` file or the build settings are incorrect.

---

## ✅ Solution: Update Netlify Build Settings

### Option 1: Fix in Netlify Dashboard (Easiest)

1. **Go to Netlify Dashboard:**
   - Visit: https://app.netlify.com
   - Click on your site: `projectplannerweb`

2. **Go to Site Settings:**
   - Click **"Site settings"** (top right)
   - Click **"Build & deploy"** (left sidebar)

3. **Update Build Settings:**
   - **Base directory:** Leave empty (or set to `/` if it's not empty)
   - **Build command:** `npm run build`
   - **Publish directory:** Leave empty (Next.js plugin handles this)

4. **Save and Redeploy:**
   - Click **"Save"**
   - Go to **"Deploys"** tab
   - Click **"Trigger deploy"** → **"Clear cache and deploy site"**

---

### Option 2: Verify netlify.toml is in Repository

The `netlify.toml` file should be in the root of your GitHub repository.

**Check on GitHub:**
1. Go to: https://github.com/farnienel1/project-planner-web
2. Look for `netlify.toml` in the file list
3. If it's missing, we need to push it

**If missing, run these commands:**
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git add netlify.toml
git commit -m "Add netlify.toml configuration"
git push origin main
```

---

## 🔍 Verify Your Repository Structure

Your GitHub repo should have this structure:
```
project-planner-web/
├── package.json          ← Must be in root
├── netlify.toml          ← Must be in root
├── next.config.js
├── tailwind.config.js
├── app/
├── lib/
└── ...
```

**If your repo has a `web-app/` folder, that's the problem!**

The repository root should be the Next.js app root, not a parent folder.

---

## ✅ Correct netlify.toml Content

Your `netlify.toml` should look like this:

```toml
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

**Important:** No `publish` directory specified - the Next.js plugin handles it!

---

## 🚀 After Fixing

1. **Trigger a new deploy** in Netlify
2. **Watch the build logs** - should see:
   - ✅ Installing dependencies
   - ✅ Running build command
   - ✅ Build succeeded
3. **Visit your site** - should work!

---

## 🐛 Still Not Working?

If it still fails:

1. **Check build logs** for specific errors
2. **Verify package.json** has `"build": "next build"` script
3. **Make sure Node version** is 18+ (set in netlify.toml)
4. **Clear Netlify cache** and redeploy

---

**The fix is usually just updating the build settings in Netlify dashboard!**
