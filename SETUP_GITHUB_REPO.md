# Set Up GitHub Repository - Step by Step

## Step 1: Create GitHub Repository

1. **Go to:** [github.com](https://github.com)
2. **Sign in** (or create account)
3. **Click:** The **"+"** icon (top right corner)
4. **Click:** "New repository"
5. **Repository name:** `project-planner-web`
6. **Description:** "Desktop web version of Project Planner"
7. **Choose:** Public or Private
8. **IMPORTANT:** Do NOT check any boxes (no README, no .gitignore, no license)
9. **Click:** "Create repository"

---

## Step 2: Get Your Repository URL

After creating the repository, GitHub will show you a page with instructions.

**You'll see a URL like:**
```
https://github.com/YOUR_USERNAME/project-planner-web.git
```

**Copy this URL!**

---

## Step 3: Update Git Remote

**In Terminal, run:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

**Example:**
- If your username is `farnienel`, use:
  ```bash
  git remote add origin https://github.com/farnienel/project-planner-web.git
  ```

---

## Step 4: Create Personal Access Token

**You need a token to push (GitHub doesn't accept passwords anymore):**

1. **Go to:** GitHub → Your profile → Settings
2. **Click:** "Developer settings" (bottom of left sidebar)
3. **Click:** "Personal access tokens" → "Tokens (classic)"
4. **Click:** "Generate new token" → "Generate new token (classic)"
5. **Note:** "Project Planner Web"
6. **Expiration:** 90 days (or No expiration)
7. **Check:** `repo` (gives full repository access)
8. **Click:** "Generate token"
9. **COPY THE TOKEN** - You won't see it again!
   - Looks like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 5: Push to GitHub

**In Terminal, run:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git push -u origin main
```

**When it asks:**
- **Username:** Your GitHub username
- **Password:** Paste the token you just created (NOT your GitHub password!)

**Or use the token in the URL:**

```bash
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/project-planner-web.git
git push -u origin main
```

---

## Quick Commands (After Creating Repo)

**Replace YOUR_USERNAME and YOUR_TOKEN:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote remove origin
git remote add origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/project-planner-web.git
git push -u origin main
```

---

## Alternative: Use GitHub CLI (Easier)

**Install GitHub CLI:**

```bash
brew install gh
```

**Login:**

```bash
gh auth login
```

**Follow prompts** - it will open browser to authenticate.

**Then push:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/project-planner-web.git
git push -u origin main
```

---

## Summary

**What you need:**
1. ✅ Create GitHub repository
2. ✅ Get your GitHub username
3. ✅ Create Personal Access Token
4. ✅ Update remote URL with your username
5. ✅ Push using token as password

**Tell me your GitHub username and I'll give you the exact commands!** 🚀
