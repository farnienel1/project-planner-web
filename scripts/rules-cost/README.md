# Rules compile-cost tools

These tools measure how expensive `firestore.rules` is for Google's rules compiler. Since 1.31.0 the deploy compile (`firebaserules.googleapis.com …:test`) and the console Publish have failed with HTTP 503 or "unknown error". Diagnosis and numbers are in `docs/rules-cost/README.md`.

## Tools

| File | What it does |
|---|---|
| `rp.py` | Minimal structural parser for the rules: functions (params, lets, return, enclosing match scope), allow statements, call sites. |
| `metric.py` | Static cost proxy. `python3 metric.py FILE…` prints bytes, tokens, functions, lets, allows, call depth and **inlined_tokens**, the fully-inlined token count of every allow condition. `total2(FILE)` returns `(allow roots, function roots, total, calls)`. `total` is the best predictor of compile time. |
| `hot.py` | `python3 hot.py FILE [N]` lists the functions that contribute most to the inlined total (expansions × own body) and the most expensive allow statements. |
| `inline.py` | `python3 inline.py IN OUT [maxsites]` inlines functions that have no `let`, are called from at most `maxsites` places, and need no renaming (it checks free variables against the caller's params, lets and match variables). A parameter used more than once is substituted only when its argument is an identifier or a literal. |
| `ctime.py` | `EMU_PORT=8313 python3 ctime.py N FILE…` PUTs each file to a running Firestore emulator's `:securityRules` endpoint and reports time and type issues. 0 issues means the console's type checker is clean. |
| `Compile.java` | In-process timing with the emulator's own compiler (`FirebaseRulesProtoCompiler`), which is less noisy than HTTP. See below. |
| `noallow.py`, `ablate.py` | Experiments: replace every allow with `false`; replace one function body with `true`. |

## Compile timing (in-process)

The jar is not committed. It is the Firestore emulator that firebase-tools downloads: run any `firebase emulators:start --only firestore` once, and it lands at `~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar`.

```
J=~/.cache/firebase/emulators/cloud-firestore-emulator-v1.19.8.jar
javac -proc:none -cp $J -d /tmp/rc scripts/rules-cost/Compile.java
java -cp $J:/tmp/rc Compile 2 5 old.rules firestore.rules   # warm-up runs, measured runs, files...
```

Compare files in the same run, because the machine's load moves absolute numbers by ±10–15%. Read the `min` column.

## Type check (what the console rejects)

Start the emulator (`java -jar $J --host 127.0.0.1 --port 8313`). Then `PUT http://127.0.0.1:8313/emulator/v1/projects/<any>:securityRules` with body `{"rules":{"files":[{"name":"firestore.rules","content":…}]}}`. `ctime.py` does this. Every `issues[]` entry with `Invalid type` is an error the console reports. `Unused function` is a warning only.
