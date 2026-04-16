# 🚀 Quick Netlify Setup - 5 Minutes

## ✅ Step 1: Code is Already on GitHub!
- Repository: `https://github.com/farnienel1/project-planner-web.git`
- Latest code pushed ✅

---

## 📝 Step 2: Connect to Netlify (2 minutes)

1. **Go to:** https://app.netlify.com
2. **Click:** "Add new site" → "Import an existing project"
3. **Click:** "GitHub" (authorize if needed)
4. **Select:** `farnienel1/project-planner-web`
5. **Build settings** (should auto-detect):
   - Build command: `npm run build`
   - Publish directory: `.next`
6. **Click:** "Deploy site"

---

## 🔐 Step 3: Add Environment Variables (2 minutes)

**Get values from:** `/Users/farnienel/Desktop/Project Planner/web-app/.env.local`

1. In Netlify: **Site settings** → **Environment variables**
2. **Add these 6 variables:**

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

3. **Click:** "Save"
4. **Go to:** "Deploys" tab
5. **Click:** "Trigger deploy" → "Clear cache and deploy site"

---

## ✅ Step 4: Done!

- Wait 2-5 minutes for build
- Visit your site URL
- Login and test!

---

## 🔄 Automatic Updates

**Every time you push to GitHub:**
- Netlify automatically builds and deploys
- No manual steps needed! 🎉

---

**Need help?** See `NETLIFY_CONNECTION_STEPS.md` for detailed instructions.




