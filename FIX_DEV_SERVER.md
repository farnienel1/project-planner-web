# Fix dev server errors (500, turbopack runtime missing)

If you see:

- `GET /setup 500`
- `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`

the Next.js cache is corrupted. Run this from the **project folder**:

```bash
cd ~/project-planner-web
npm run dev:clean
npm run dev
```

If it still fails:

```bash
cd ~/project-planner-web
npm run dev:webpack
```

Last resort (slow but reliable):

```bash
cd ~/project-planner-web
npm run dev:clean
rm -rf node_modules
npm install
npm run dev
```

**Always run commands from `~/project-planner-web`**, not your home folder (`~`).
