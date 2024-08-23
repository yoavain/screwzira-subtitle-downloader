// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
    testEnvironment: "node",
    clearMocks: true,
    transform: {
        "^.+\\.ts$": ["ts-jest", {
            tsconfig: "tsconfig.jest.json",
            isolatedModules: true
        }]
    },
    testRegex: "test/.*.test.ts$",
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "^~src/(.*)": "<rootDir>/src/$1",
        "^~test/(.*)": "<rootDir>/test/$1",
        "^~resources/(.*)": "<rootDir>/resources/$1"
    },
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageReporters: [
        "text",
        "text-summary",
        "json",
        "lcov",
        "clover"
    ],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/index.ts",
        "!src/parsers/screwzira/**"
    ],
    verbose: true
};

export default config;
