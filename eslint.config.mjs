// ESLint flat config (ESLint 9+). Replaces .eslintrc.json ("extends": "next/core-web-vitals"):
// the same Next core-web-vitals set, now from eslint-config-next 16.
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const reactHooksPlugin = nextVitals.find((config) => config.plugins?.['react-hooks'])?.plugins['react-hooks']

export default defineConfig([
  ...nextVitals,
  {
    // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds React Compiler rules that the
    // old config (react-hooks 4: rules-of-hooks, exhaustive-deps) never ran. These four already flag existing
    // code (about 180 places); fixing them means refactoring effects and refs, which is not behaviour-neutral,
    // so they report as warnings until that clean-up is done. Every other react-hooks rule stays an error.
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
