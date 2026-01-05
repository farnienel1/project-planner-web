# How to Navigate to web-app Folder

## The Problem

The folder path has spaces: `Project Planner` - you need to put quotes around it.

---

## Solution: Copy and Paste This Exact Command

**In Terminal, copy and paste this entire line:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

**Press Enter**

---

## Step-by-Step

### Step 1: Open Terminal
- Press `Cmd + Space`
- Type: `Terminal`
- Press Enter

### Step 2: Copy This Exact Command
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

### Step 3: Paste in Terminal
- Click in Terminal window
- Press `Cmd + V` (paste)
- Press Enter

### Step 4: Verify You're There
Type:
```bash
pwd
```

**Should show:** `/Users/farnienel/Desktop/Project Planner/web-app`

### Step 5: Check package.json Exists
Type:
```bash
ls package.json
```

**Should show:** `package.json`

### Step 6: Now Run npm
```bash
npm run dev
```

---

## Alternative: Navigate Step by Step

If the full path doesn't work, try this:

```bash
cd ~/Desktop
cd "Project Planner"
cd web-app
```

Then verify:
```bash
pwd
```

Should show: `/Users/farnienel/Desktop/Project Planner/web-app`

---

## Common Mistakes

### ❌ Wrong (No Quotes):
```bash
cd /Users/farnienel/Desktop/Project Planner/web-app
```
**Problem:** Spaces in "Project Planner" break the command

### ✅ Correct (With Quotes):
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```
**Solution:** Quotes handle spaces correctly

---

## Quick Test

After navigating, test with:
```bash
ls
```

You should see:
- `package.json`
- `app/`
- `lib/`
- `node_modules/`
- etc.

---

## If Still Not Working

Try this alternative path format:

```bash
cd ~/Desktop/"Project Planner"/web-app
```

Or escape the spaces:

```bash
cd ~/Desktop/Project\ Planner/web-app
```

---

## Summary

**The exact command you need:**
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

**Then:**
```bash
npm run dev
```

**That's it!** 🚀
