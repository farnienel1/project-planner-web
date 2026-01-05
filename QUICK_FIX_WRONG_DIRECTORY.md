# Quick Fix: Wrong Directory Error

## The Problem

You're trying to run `npm` commands from the wrong folder. You need to be in the `web-app` folder.

---

## Quick Fix

### Step 1: Navigate to the Correct Folder

In Terminal, type this command:

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

**Press Enter**

### Step 2: Verify You're in the Right Place

Type this to check:

```bash
pwd
```

**Should show:** `/Users/farnienel/Desktop/Project Planner/web-app`

### Step 3: Check package.json Exists

Type this:

```bash
ls package.json
```

**Should show:** `package.json` (the file exists)

### Step 4: Now Run Your Command

Now you can run:
```bash
npm run dev
```

**Should work!** ✅

---

## Why This Happened

You were in: `/Users/farnienel/` (your home folder)
You need to be in: `/Users/farnienel/Desktop/Project Planner/web-app/`

---

## Quick Reference

**Always navigate to web-app folder first:**
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

**Then run commands:**
```bash
npm run dev      # Start dev server
npm install      # Install dependencies
npm run build    # Build for production
```

---

## Pro Tip

**Create an alias** (optional):

Add this to your `~/.zshrc` file:
```bash
alias ppweb='cd "/Users/farnienel/Desktop/Project Planner/web-app"'
```

Then you can just type `ppweb` to go to the folder!

---

## Summary

**The fix:**
1. `cd "/Users/farnienel/Desktop/Project Planner/web-app"`
2. Then run your npm commands

**That's it!** 🚀
