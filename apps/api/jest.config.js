/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    // Workspace packages resolve to source, matching how ts-node runs the app.
    '^@areia-bela/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@areia-bela/types$': '<rootDir>/../../../packages/types/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  // otplib and its @scure/base dependency ship ESM only, so they have to be
  // transformed rather than skipped like the rest of node_modules.
  transformIgnorePatterns: ['/node_modules/\\.pnpm/(?!(otplib|@otplib|@scure|@noble)).*'],
}
