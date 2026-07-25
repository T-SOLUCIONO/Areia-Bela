import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    // eslint-plugin-react-hooks v7 (bundled with eslint-config-next 16) adds
    // React Compiler-readiness rules. `set-state-in-effect` flags several
    // pre-existing external-state-sync effects (matchMedia, localStorage,
    // embla carousel callbacks). Rewriting those effect patterns safely is
    // real refactoring work — tracked for Fase 8 (Calidad), not bundled into
    // this Fase 2 tooling setup. Kept as a visible warning, not silenced.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default eslintConfig
