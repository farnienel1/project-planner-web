# What is `npm install` and How to Do It

## What is npm?

**npm** stands for "Node Package Manager" - it's a tool that comes with Node.js.

Think of it like:
- **App Store** for your computer (but for code libraries)
- **Installer** for JavaScript/TypeScript projects
- **Dependency manager** - it downloads all the code your project needs

---

## What Does `npm install` Do?

When you run `npm install`, it:

1. **Reads `package.json`** - This file lists all the code libraries your project needs
2. **Downloads all dependencies** - Gets all the required code from the internet
3. **Creates `node_modules` folder** - Stores all the downloaded code
4. **Takes 2-5 minutes** - Depending on how many libraries you need

**Think of it like:** Installing all the apps your phone needs before you can use it.

---

## How to Do It - Step by Step

### Step 1: Open Terminal

**On Mac:**
1. Press `Cmd + Space` (opens Spotlight)
2. Type: `Terminal`
3. Press `Enter`
4. Terminal window opens (black window with text)

**Or:**
- Go to: Applications → Utilities → Terminal

### Step 2: Navigate to Your Project Folder

In Terminal, type this command and press Enter:

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

**What this does:**
- `cd` = "change directory" (go to a folder)
- The path is your web-app folder location

**You should see:**
- The prompt changes to show you're in the web-app folder
- Something like: `web-app $` or similar

### Step 3: Run npm install

Type this command and press Enter:

```bash
npm install
```

**What happens:**
- Terminal shows lots of text scrolling
- Downloads packages (you'll see package names)
- Takes 2-5 minutes
- Shows progress bars

**You'll see output like:**
```
npm WARN deprecated ...
added 245 packages, and audited 246 packages in 45s
```

### Step 4: Wait for It to Finish

**When it's done, you'll see:**
- ✅ No errors
- ✅ Message like "added X packages"
- ✅ Back to the command prompt (you can type again)

**If successful:**
- You'll see a new folder called `node_modules` in your web-app folder
- This folder contains all the downloaded code

---

## What You Should See

### ✅ Success Looks Like:

```bash
$ npm install

added 245 packages, and audited 246 packages in 45s

found 0 vulnerabilities
```

### ❌ If You See Errors:

**Error: "command not found: npm"**
- **Problem:** Node.js is not installed
- **Solution:** Install Node.js from [nodejs.org](https://nodejs.org/)
- Download the LTS version
- Install it, then try again

**Error: "EACCES" or permission errors**
- **Problem:** Permission issues
- **Solution:** Try: `sudo npm install` (enter your Mac password when asked)

**Error: Network/timeout errors**
- **Problem:** Internet connection issue
- **Solution:** Check your internet, try again

---

## Visual Guide

### Terminal Window:

```
Last login: Mon Jan 15 10:30:45 on ttys000
farnienel@MacBook-Pro ~ % cd "/Users/farnienel/Desktop/Project Planner/web-app"
farnienel@MacBook-Pro web-app % npm install

> project-planner-web@1.0.0 install
> next install

npm WARN deprecated ...
added 245 packages, and audited 246 packages in 45s

found 0 vulnerabilities

farnienel@MacBook-Pro web-app %
```

**Notice:**
- You type commands after the `%` or `$` symbol
- Press Enter after each command
- Wait for it to finish before typing the next command

---

## Quick Reference

### The Commands (In Order):

```bash
# 1. Open Terminal (from Spotlight or Applications)

# 2. Go to your project folder
cd "/Users/farnienel/Desktop/Project Planner/web-app"

# 3. Install dependencies
npm install

# 4. Wait for it to finish (2-5 minutes)

# 5. Done! ✅
```

---

## After npm install

Once `npm install` is complete, you can:

1. **Run the development server:**
   ```bash
   npm run dev
   ```

2. **Build for production:**
   ```bash
   npm run build
   ```

---

## Common Questions

### Q: Do I need to run `npm install` every time?
**A:** No! Only when:
- First time setting up the project
- Someone adds new dependencies
- You delete the `node_modules` folder

### Q: How long does it take?
**A:** Usually 2-5 minutes, depending on:
- Your internet speed
- How many packages need to be downloaded
- Your computer speed

### Q: Can I close Terminal while it's running?
**A:** No! Keep Terminal open until it finishes. You'll see when it's done.

### Q: What if it gets stuck?
**A:** 
- Wait a few minutes (sometimes it's just slow)
- Press `Ctrl + C` to cancel
- Check your internet connection
- Try again: `npm install`

### Q: Do I need internet?
**A:** Yes! npm downloads packages from the internet.

---

## Troubleshooting

### Problem: "npm: command not found"

**Solution:**
1. Install Node.js: [nodejs.org](https://nodejs.org/)
2. Download the LTS version (Long Term Support)
3. Install it (double-click the downloaded file)
4. Restart Terminal
5. Try `npm install` again

### Problem: Takes forever / Very slow

**Solution:**
- This is normal for first install
- Can take 5-10 minutes
- Be patient, let it finish
- Check your internet connection

### Problem: Permission errors

**Solution:**
- Try: `sudo npm install`
- Enter your Mac password when asked
- Or fix npm permissions (more advanced)

---

## Summary

**`npm install` means:**
- Download all the code libraries your project needs
- Install them in a `node_modules` folder
- Set up your project so it can run

**How to do it:**
1. Open Terminal
2. Go to web-app folder: `cd "/Users/farnienel/Desktop/Project Planner/web-app"`
3. Run: `npm install`
4. Wait 2-5 minutes
5. Done! ✅

**That's it!** Once it's done, you can run `npm run dev` to start your app!

---

## Next Steps

After `npm install` completes:

1. **Set up environment variables** (create `.env.local`)
2. **Run development server:** `npm run dev`
3. **Open browser:** `http://localhost:3000`

See `QUICK_START.md` for the complete setup process!
