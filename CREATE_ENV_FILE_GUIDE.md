# How to Create .env.local File

## Quick Answer

The `.env.local` file stores your Firebase configuration. Here are 3 easy ways to create it.

---

## Method 1: Using Terminal (Easiest) ⭐

### Step 1: Open Terminal
- Press `Cmd + Space`
- Type: `Terminal`
- Press Enter

### Step 2: Go to your project folder
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
```

### Step 3: Create the file
Type this command and press Enter:

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-planner-f986c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-planner-f986c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-planner-f986c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980527300983
NEXT_PUBLIC_FIREBASE_APP_ID=1:980527300983:web:project-planner
EOF
```

**That's it!** The file is created with all your Firebase config.

---

## Method 2: Using TextEdit (Visual)

### Step 1: Open TextEdit
- Press `Cmd + Space`
- Type: `TextEdit`
- Press Enter

### Step 2: Create new document
- File → New (or `Cmd + N`)

### Step 3: Paste this content:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-planner-f986c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-planner-f986c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-planner-f986c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980527300983
NEXT_PUBLIC_FIREBASE_APP_ID=1:980527300983:web:project-planner
```

### Step 4: Save the file
- Press `Cmd + S` (or File → Save)
- **Important:** Navigate to: `/Users/farnienel/Desktop/Project Planner/web-app/`
- **File name:** `.env.local` (with the dot at the start!)
- **Format:** Plain Text (not Rich Text)
- Click Save

**Note:** If TextEdit asks about the dot, click "Use .env.local"

---

## Method 3: Using VS Code (If You Have It)

### Step 1: Open VS Code
- Open VS Code
- File → Open Folder
- Navigate to: `/Users/farnienel/Desktop/Project Planner/web-app/`

### Step 2: Create new file
- Click the "New File" icon (or `Cmd + N`)
- Name it: `.env.local`

### Step 3: Paste this content:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-planner-f986c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-planner-f986c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-planner-f986c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980527300983
NEXT_PUBLIC_FIREBASE_APP_ID=1:980527300983:web:project-planner
```

### Step 4: Save
- Press `Cmd + S`

---

## Verify the File Was Created

### Using Terminal:
```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
ls -la | grep .env.local
```

You should see: `.env.local`

### Using Finder:
1. Open Finder
2. Go to: Desktop → Project Planner → web-app
3. Press `Cmd + Shift + .` (shows hidden files)
4. Look for `.env.local`

---

## Important Notes

### ✅ File Name Must Be Exact:
- `.env.local` (with the dot at the start)
- Not `env.local` (missing dot)
- Not `.env.local.txt` (extra extension)

### ✅ Location Must Be Correct:
- Must be in the `web-app` folder
- Same folder as `package.json`
- Not in a subfolder

### ✅ Format:
- Plain text (not Rich Text)
- One variable per line
- No spaces around the `=` sign

---

## Troubleshooting

### Problem: Can't see the file in Finder

**Solution:**
- Files starting with `.` are hidden by default
- Press `Cmd + Shift + .` in Finder to show hidden files
- Or just use Terminal to verify it exists

### Problem: TextEdit saves as .txt

**Solution:**
- When saving, make sure to:
  1. Type `.env.local` in the filename field
  2. Remove `.txt` if it appears
  3. Choose "Plain Text" format
  4. Click Save

### Problem: File not found error

**Solution:**
- Make sure the file is in the `web-app` folder
- Check the filename is exactly `.env.local`
- Use Terminal to verify: `ls -la | grep .env`

---

## Quick Copy-Paste Content

Here's the exact content for your `.env.local` file:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCPafzxnt3q2Q_xQ4N6BYrhNyUOJSiL1Yc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-planner-f986c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-planner-f986c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-planner-f986c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=980527300983
NEXT_PUBLIC_FIREBASE_APP_ID=1:980527300983:web:project-planner
```

**Just copy this and paste into your file!**

---

## After Creating the File

Once `.env.local` is created:

1. **Verify it exists:**
   ```bash
   ls -la | grep .env.local
   ```

2. **Start your app:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   - Go to: `http://localhost:3000`
   - You should see the login page!

---

## Summary

**Easiest Method:**
1. Open Terminal
2. Go to web-app folder
3. Run the `cat` command (Method 1 above)
4. Done! ✅

**Visual Method:**
1. Open TextEdit
2. Paste the content
3. Save as `.env.local` in web-app folder
4. Done! ✅

**The file is ready!** Now you can run `npm run dev` to start your app! 🚀
