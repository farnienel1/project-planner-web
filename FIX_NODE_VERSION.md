# Fix: Node.js Version Error - Step by Step

## The Problem

Your Node.js version is too old. You need Node.js 18+ for Next.js 14.

---

## Complete Fix (Follow All Steps)

### Step 1: Check Current Node Version

In Terminal, type:
```bash
node --version
```

**Write down what it shows** (e.g., `v14.17.0` or `v16.15.0`)

### Step 2: Download Latest Node.js

1. **Go to:** [nodejs.org](https://nodejs.org/)
2. **Click:** The big green "Download" button (LTS version)
   - Should say something like "20.x.x LTS" or "18.x.x LTS"
3. **Download** the `.pkg` file for Mac
4. **Wait** for download to finish

### Step 3: Install Node.js

1. **Open** the downloaded file (usually in Downloads folder)
2. **Double-click** the `.pkg` file
3. **Follow** the installation wizard:
   - Click "Continue" through all steps
   - Enter your Mac password when asked
   - Click "Install"
4. **Wait** for installation to complete
5. **Click** "Close" when done

### Step 4: Close ALL Terminal Windows

**Important:** You must close ALL Terminal windows for the new version to be used.

1. **Quit Terminal completely:**
   - Press `Cmd + Q` in Terminal
   - Or: Terminal → Quit Terminal

2. **Wait 5 seconds**

3. **Open Terminal again:**
   - Press `Cmd + Space`
   - Type: `Terminal`
   - Press Enter

### Step 5: Verify New Node Version

In the NEW Terminal window, type:
```bash
node --version
```

**Should show:** `v18.x.x` or `v20.x.x` (or higher)

**If it still shows old version:**
- Make sure you closed ALL Terminal windows
- Try restarting your Mac
- Or use the full path: `/usr/local/bin/node --version`

### Step 6: Clean Everything

In Terminal:
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"

# Delete everything
rm -rf node_modules
rm -rf .next
rm package-lock.json
```

### Step 7: Reinstall Dependencies

```bash
npm install
```

**Wait for it to finish** (2-5 minutes)

### Step 8: Try Running Again

```bash
npm run dev
```

**Should work now!** ✅

---

## If Still Not Working

### Option A: Use Full Node Path

Sometimes Terminal uses an old cached version. Try:

```bash
# Find where new Node is installed
which node

# Use the full path
/usr/local/bin/node --version
```

If that shows the new version, you might need to update your PATH.

### Option B: Restart Your Mac

Sometimes a full restart helps:
1. Restart your Mac
2. Open Terminal
3. Check: `node --version`
4. Should show new version

### Option C: Use nvm (Node Version Manager)

If you have multiple Node versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart Terminal, then:
nvm install 18
nvm use 18
node --version
```

---

## Quick Checklist

- [ ] Downloaded Node.js 18+ from nodejs.org
- [ ] Installed the .pkg file
- [ ] Closed ALL Terminal windows
- [ ] Opened NEW Terminal window
- [ ] Verified: `node --version` shows 18+
- [ ] Deleted `node_modules` and `.next` folders
- [ ] Ran `npm install` again
- [ ] Tried `npm run dev`

---

## What Version Do You Need?

- **Minimum:** Node.js 16.0.0
- **Recommended:** Node.js 18.x or 20.x (LTS)
- **Current Next.js 14 requires:** Node.js 18.17.0 or later

---

## Summary

**The fix:**
1. ✅ Download Node.js 18+ from nodejs.org
2. ✅ Install it
3. ✅ **Close ALL Terminal windows** (important!)
4. ✅ Open NEW Terminal
5. ✅ Verify: `node --version` shows 18+
6. ✅ Delete `node_modules` and `.next`
7. ✅ Run `npm install`
8. ✅ Run `npm run dev`

**The key is closing and reopening Terminal after installing Node.js!**
