# Connect to Netlify - Step by Step

## ✅ Step 1: Code Pushed to GitHub
**Status:** ✅ **DONE!**
- Repository: `https://github.com/farnienel1/project-planner-web.git`
- Latest commit pushed successfully

---

## 🚀 Step 2: Connect to Netlify

### Option A: New Netlify Site (Recommended)

1. **Go to Netlify:**
   - Visit: https://app.netlify.com
   - Sign in (or create account if needed)

2. **Add New Site:**
   - Click **"Add new site"** button (top right)
   - Select **"Import an existing project"**

3. **Connect to Git Provider:**
   - Click **"GitHub"** (or the Git provider you're using)
   - Authorize Netlify to access your GitHub account if prompted

4. **Select Repository:**
   - Search for: `project-planner-web`
   - Click on `farnienel1/project-planner-web`

5. **Configure Build Settings:**
   - **Branch to deploy:** `main` (should be default)
   - **Build command:** `npm run build` (should auto-detect)
   - **Publish directory:** `.next` (should auto-detect)
   
   ⚠️ **IMPORTANT:** If it doesn't auto-detect, manually set:
   - Build command: `npm run build`
   - Publish directory: `.next`

6. **Click "Deploy site"**

---

### Option B: Netlify CLI (Alternative)

If you prefer command line:

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

---

## 🔐 Step 3: Add Environment Variables

**CRITICAL:** Your app needs Firebase credentials to work!

1. **In Netlify Dashboard:**
   - Go to your site
   - Click **"Site settings"** (top right)
   - Click **"Environment variables"** (left sidebar)
   - Click **"Add variable"**

2. **Add Each Variable:**
   Add these 6 variables (get values from your `.env.local` file):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
   ```

3. **After Adding Variables:**
   - Click **"Save"**
   - Go back to **"Deploys"** tab
   - Click **"Trigger deploy"** → **"Clear cache and deploy site"**

---

## 🌐 Step 4: Custom Domain (Optional)

If you want to use `projectplanner.us`:

1. **In Netlify Dashboard:**
   - Go to **"Domain settings"**
   - Click **"Add custom domain"**
   - Enter: `projectplanner.us`
   - Follow DNS setup instructions

2. **Update DNS Records in Namecheap:**
   - Add CNAME record pointing to your Netlify site
   - Netlify will show you the exact values

---

## ✅ Step 5: Verify Deployment

1. **Wait for Build:**
   - Netlify will show build progress
   - First build takes 2-5 minutes

2. **Check Build Logs:**
   - Click on the deploy
   - Check for any errors
   - Should see: "Build succeeded"

3. **Visit Your Site:**
   - Click the site URL (e.g., `https://random-name-123.netlify.app`)
   - Should see login page

4. **Test Login:**
   - Try logging in with your Firebase credentials
   - Should redirect to dashboard

---

## 🔄 Step 6: Automatic Updates

**Once connected, updates are automatic!**

- Every time you push to GitHub `main` branch
- Netlify automatically:
  1. Detects the push
  2. Runs `npm run build`
  3. Deploys the new version
  4. Updates your live site

**No manual steps needed!** 🎉

---

## 🐛 Troubleshooting

### Build Fails:
- Check build logs in Netlify
- Verify environment variables are set
- Make sure `package.json` has correct scripts

### Site Shows 404:
- Check publish directory is `.next`
- Verify build command is `npm run build`
- Check Netlify plugin is installed (should auto-detect Next.js)

### Environment Variables Not Working:
- Make sure all variables start with `NEXT_PUBLIC_`
- Redeploy after adding variables
- Check variable names match exactly

### Can't Connect to GitHub:
- Make sure you're logged into correct GitHub account
- Check repository is public (or grant Netlify access)
- Try disconnecting and reconnecting

---

## 📋 Quick Checklist

- [ ] Code pushed to GitHub ✅
- [ ] Netlify account created/logged in
- [ ] Site connected to GitHub repository
- [ ] Build settings configured (`npm run build`, `.next`)
- [ ] Environment variables added (all 6 Firebase variables)
- [ ] Site deployed successfully
- [ ] Can access login page
- [ ] Can log in and see dashboard

---

## 🎯 Next Steps After Deployment

1. **Test all features:**
   - Login/logout
   - View projects, operatives, managers
   - Create/edit items (if forms are implemented)
   - Check data syncs with iOS app

2. **Set up custom domain** (if desired)

3. **Monitor deployments:**
   - Check Netlify dashboard for build status
   - Review any build warnings

4. **Future updates:**
   - Just push to GitHub
   - Netlify handles the rest automatically!

---

**Your web app is ready to go live! 🚀**




