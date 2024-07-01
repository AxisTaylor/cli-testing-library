import type { Config } from 'jest';

const config: Config = {
    setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
    preset: 'ts-jest',
    testEnvironment: 'node',
};

export default config;
