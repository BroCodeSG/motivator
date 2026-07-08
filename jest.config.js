/** Tests only cover the pure date logic in src/lib/periods.ts, so plain
 * ts-jest in a node environment is enough — no jest-expo needed. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
};
