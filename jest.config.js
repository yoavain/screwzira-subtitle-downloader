module.exports = {
    clearMocks: true,
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    testRegex: 'test/.*.test.ts$',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    moduleNameMapper: {
        "^~src/(.*)": "<rootDir>/src/$1",
        "^~test/(.*)": "<rootDir>/test/$1",
        "^~resources/(.*)": "<rootDir>/resources/$1"
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/parsers/screwzira/**"
    ],
    verbose: true
};
