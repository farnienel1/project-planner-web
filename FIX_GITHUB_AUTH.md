# Fix: GitHub Authentication Failed

## The Problem

GitHub requires authentication to push code. You need to set up credentials.

---

## Solution: Use Personal Access Token

### Step 1: Create Personal Access Token

1. **Go to GitHub:**
   - Visit: [github.com](https://github.com)
   - Sign in

2. **Go to Settings:**
   - Click your profile picture (top right)
   - Click **"Settings"**

3. **Go to Developer Settings:**
   - Scroll down in left sidebar
   - Click **"Developer settings"**

4. **Create Token:**
   - Click **"Personal access tokens"** → **"Tokens (classic)"**
   - Click **"Generate new token"** → **"Generate new token (classic)"**

5. **Configure Token:**
   - **Note:** "Project Planner Web App"
   - **Expiration:** Choose 90 days (or No expiration)
   - **Scopes:** Check **"repo"** (this gives full repository access)
   - Click **"Generate token"**

6. **Copy the Token:**
   - **IMPORTANT:** Copy it immediately! You won't see it again.
   - It looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### Step 2: Use Token When Pushing

**When you run `git push`, it will ask for:**
- **Username:** Your GitHub username
- **Password:** Paste the token (NOT your GitHub password!)

**Or set it up once:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/project-planner-web.git
```

**Replace:**
- `YOUR_USERNAME` = Your GitHub username
- `YOUR_TOKEN` = The token you just created

**Then push:**
```bash
git push -u origin main
```

---

## Alternative: Use GitHub CLI (Easier)

### Install GitHub CLI:

```bash
brew install gh
```

### Authenticate:

```bash
gh auth login
```

Follow the prompts - it will open a browser to authenticate.

### Then push:

```bash
git push -u origin main
```

---

## Quick Fix: Update Remote URL

If you already added the remote, update it:

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
```

Then when pushing, use the token as password.

---

## Summary

**Easiest method:**
1. Create Personal Access Token on GitHub
2. When `git push` asks for password, use the token (not your password)

**Or use GitHub CLI:**
```bash
brew install gh
gh auth login
git push -u origin main
```

---

## Need Help?

Tell me:
- **What exact error message do you see?**
- **Do you have a GitHub account?**
- **What's your GitHub username?**

I can help you with the exact commands! 🚀
