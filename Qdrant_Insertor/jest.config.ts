// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        target: 'es2022',
      },
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // 让 ESM import '.../x.ts' 和 '.../x.js' 两种写法都能被解析
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^config$': '<rootDir>/config.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: [],
};

export default config;