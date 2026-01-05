# Fix: "Unable to acquire lock" Error

## The Problem

Another instance of `npm run dev` is already running. You can only run one dev server at a time.

---

## Quick Fix

### Option 1: Kill the Process (Recommended)

**In Terminal, run:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
lsof -ti:3000 | xargs kill -9
```

**Then try again:**
```bash
npm run dev
```

---

### Option 2: Remove Lock File

**In Terminal, run:**

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
rm -rf .next/dev/lock
```

**Then try again:**
```bash
npm run dev
```

---

### Option 3: Find and Kill the Process Manually

1. **Find the process:**
   ```bash
   lsof -i:3000
   ```

2. **Kill it:**
   ```bash
   kill -9 [PID]
   ```
   (Replace [PID] with the number from step 1)

---

### Option 4: Restart Terminal

1. **Quit Terminal completely:**
   - Press `Cmd + Q` in Terminal
   - Or: Terminal → Quit Terminal

2. **Open Terminal again**

3. **Navigate and run:**
   ```bash
   cd "/Users/farnienel/Desktop/Project Planner/web-app"
   npm run dev
   ```

---

## Why This Happens

- You started `npm run dev` before
- The process is still running in the background
- Next.js prevents multiple instances from running

---

## Prevention

**Always stop the dev server before:**
- Closing Terminal
- Running `npm run dev` again
- Restarting your computer

**To stop the dev server:**
- Press `Ctrl + C` in the Terminal window where it's running

---

## Summary

**Quick fix:**
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Or:**
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
rm -rf .next/dev/lock
npm run dev
```

**That should fix it!** 🚀
