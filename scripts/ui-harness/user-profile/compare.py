"""compare.py BEFORE.json AFTER.json — field-by-field comparison of store calls, Firestore writes, navigation and
banners per scenario. Random UUIDs (new rate-history rows) are normalised."""
import json, re, sys

UUID = re.compile(r'[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}')


def norm(o):
    return json.loads(UUID.sub('<uuid>', json.dumps(o, sort_keys=True)))


def flat(o, prefix=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from flat(v, f'{prefix}.{k}' if prefix else k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from flat(v, f'{prefix}[{i}]')
    else:
        yield prefix, o


before, after = (json.load(open(p)) for p in sys.argv[1:3])
bad = 0
for name in before:
    a, b = norm(before[name]), norm(after.get(name, {}))
    # Banners: every banner text either page shows must be on both pages (the old page marked only some of them).
    ra, rb = a.pop('rootText', ''), b.pop('rootText', '')
    texts = sorted(set(a.pop('banners')) | set(b.pop('banners')))
    sq = lambda s: re.sub(r'\s+', '', s).lower()  # innerText applies CSS text-transform
    missing = [x for x in texts if sq(x) not in sq(ra) or sq(x) not in sq(rb)]
    a['banners'] = texts
    b['banners'] = [x for x in texts if x not in missing]
    fa, fb = dict(flat(a)), dict(flat(b))
    diffs = [k for k in sorted(set(fa) | set(fb)) if fa.get(k, '<missing>') != fb.get(k, '<missing>')]
    status = 'IDENTICAL' if not diffs else f'DIFFERENT ({len(diffs)})'
    print(f'{name:22s} {status:16s} fields={len(fa)} saves={len(a["saves"] or [])} writes={len(a["writes"] or [])} nav={a["nav"]} banners={a["banners"]} errors={a["errors"]}')
    for k in diffs[:15]:
        print('   ', k, fa.get(k, '<missing>'), '->', fb.get(k, '<missing>'))
    bad += bool(diffs)
print('ALL IDENTICAL' if not bad else f'{bad} scenario(s) differ')
sys.exit(1 if bad else 0)
