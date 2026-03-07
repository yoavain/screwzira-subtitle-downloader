import { fixupPluginRules } from "@eslint/compat";
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jasmine from "eslint-plugin-jasmine";
import jest from "eslint-plugin-jest";
import n from "eslint-plugin-n";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

// region file globs

// ------------------------------------------------------------------------------------------
// File globs by type
// ------------------------------------------------------------------------------------------
const JS_FILES = ["**/*.js", "**/*.cjs", "**/*.mjs"];
const TS_FILES = ["**/*.ts"];
const TEST_FILES = ["**/test/**/*"];

// endregion file globs

// region rules

// ------------------------------------------------------------------------------------------
// Shared base configurations
// ------------------------------------------------------------------------------------------
const BASE_LANGUAGE_OPTIONS = {
    ecmaVersion: 2022,
    sourceType: "module"
};

const BASE_GLOBALS = {
    ...globals.es2021,
    ...globals.node,
    ...globals.browser,
    ...globals.jest,
    ...globals.jasmine,
    JSX: "readonly",
    KTUVIT_EMAIL: "readonly",
    KTUVIT_PASSWORD: "readonly"
};

const SHARED_PLUGINS = {
    import: fixupPluginRules(importPlugin),
    n: fixupPluginRules(n),
    unicorn: fixupPluginRules(unicorn)
};

const SHARED_SETTINGS = {
    "import/resolver": {
        node: true,
        typescript: true
    }
};

// ------------------------------------------------------------------------------------------
// Style rules
// ------------------------------------------------------------------------------------------
const STYLE_RULES = {
    "max-len": ["error", { "code": 200 }],
    "indent": ["error", 4, { "SwitchCase": 1 }],
    "quotes": ["error", "double"],
    "semi": ["error", "always"],
    "brace-style": ["error", "stroustrup"],
    "curly": ["error", "all"],
    "object-curly-spacing": ["error", "always"],
    "no-mixed-spaces-and-tabs": "error",
    "arrow-spacing": "error",
    "comma-dangle": ["error", "never"],
    "comma-style": "error",
    "no-extra-semi": "error",
    "comma-spacing": "error",
    "space-in-parens": ["error", "never"],
    "space-before-blocks": "error",
    "space-before-function-paren": [
        "error",
        { "anonymous": "never", "named": "never", "asyncArrow": "always" }
    ],
    "keyword-spacing": "error",
    "no-multi-spaces": "error",
    "space-infix-ops": "error",
    "one-var": ["error", "never"]
};

// ------------------------------------------------------------------------------------------
// Base JS quality and ecosystem rules
// ------------------------------------------------------------------------------------------
const JS_RULES = {
    ...js.configs.recommended.rules,
    "no-console": "error",
    "no-unused-vars": "off",
    "no-useless-escape": "off",
    "no-empty-pattern": "off",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-prototype-builtins": "warn",
    "no-await-in-loop": "warn",
    "require-atomic-updates": "warn",
    "no-promise-executor-return": "warn",

    // Import plugin
    "import/extensions": [
        "error",
        {
            "ts": "never",
            "js": "never",
            "mjs": "always",
            "mts": "always",
            "json": "always"
        }
    ],
    "import/named": "warn",
    "import/no-duplicates": "error",
    "import/no-unresolved": "warn",
    "import/no-default-export": "warn",
    "import/order": [
        "off", // todo - might be useful
        {
            "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
            "newlines-between": "always",
            "alphabetize": { "order": "asc", "caseInsensitive": true }
        }
    ],

    // Node plugin
    "n/no-sync": "warn",
    "n/exports-style": ["error", "module.exports"],
    "n/no-unpublished-require": "off",
    "n/no-extraneous-import": "off",
    "n/no-deprecated-api": "warn",
    "n/no-missing-require": "error",
    "n/no-missing-import": "error",
    "n/no-unpublished-import": "off",
    "n/no-unsupported-features/es-syntax": "off",
    "n/no-unsupported-features/es-builtins": ["error", { "ignores": [] }],
    "n/no-unsupported-features/node-builtins": [
        "error",
        {
            "ignores": [
                "crypto",
                "CustomEvent",
                "fetch",
                "File",
                "FormData",
                "fs.globSync",
                "navigator",
                "localStorage",
                "navigator.language",
                "navigator.platform",
                "navigator.userAgent",
                "Response",
                "sessionStorage",
                "Storage",
                "stream.Readable.fromWeb",
                "URL.createObjectURL",
                "URL.revokeObjectURL"
            ]
        }
    ],

    // Unicorn
    "unicorn/prefer-node-protocol": "error"
};

// ------------------------------------------------------------------------------------------
// TypeScript rules
// ------------------------------------------------------------------------------------------
const TS_RULES = {
    ...tseslint.configs.recommendedTypeChecked.rules,
    "no-undef": "off",
    "import/extensions": "off",
    "no-redeclare": "off",
    "@typescript-eslint/no-redeclare": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": [
        "error",
        { "prefer": "type-imports" }
    ],
    "@typescript-eslint/no-floating-promises": "warn",
    "@typescript-eslint/await-thenable": "warn",
    "@typescript-eslint/no-misused-promises": "warn",
    "@typescript-eslint/no-unnecessary-condition": "warn",
    "n/exports-style": "off"
};


// ------------------------------------------------------------------------------------------
// Test files rules
// ------------------------------------------------------------------------------------------
const TEST_RULES = {
    ...jest.configs.recommended.rules,
    "no-console": "off",
    "max-len": "off",
    "jest/no-conditional-expect": "off",
    "jest/no-done-callback": "warn",
    "jest/no-export": "off",
    "jest/no-identical-title": "warn",
    "jest/no-jasmine-globals": "off",
    "jest/no-standalone-expect": "warn",
    "jest/valid-expect": "warn",
    "jest/valid-expect-in-promise": "warn",
    "jest/valid-title": "warn"
};

// endregion rules

// region config

// ------------------------------------------------------------------------------------------
// Ignore patterns for files and directories not to lint
// ------------------------------------------------------------------------------------------
export const IGNORE_CONFIG = {
    ignores: [
        "**/node_modules/",
        "**/dist/",
        "**/build/",
        "**/coverage/",
        "**/out/",
        "**/*.min.*",
        ".serverless/"
    ]
};

// ------------------------------------------------------------------------------------------
// JavaScript files config (globals, plugins, settings, and base JS rules)
// ------------------------------------------------------------------------------------------
export const JS_CONFIG = {
    files: JS_FILES,
    languageOptions: {
        ...BASE_LANGUAGE_OPTIONS,
        globals: BASE_GLOBALS,
        parserOptions: {
            ecmaFeatures: {
                jsx: true
            }
        }
    },
    plugins: SHARED_PLUGINS,
    settings: {
        ...SHARED_SETTINGS,
        node: {
            allowModules: ["chai"],
            tryExtensions: [".ts", ".js", ".d.ts", ".json"]
        },
        import: {
            extensions: [".js", ".ts", ".d.ts", ".json"]
        }
    },
    rules: {
        ...STYLE_RULES,
        ...JS_RULES,
        "no-unused-vars": "warn"
    }
};

// ------------------------------------------------------------------------------------------
// TypeScript files config (parser, project service, plugins, and TS rules)
// ------------------------------------------------------------------------------------------
export const TS_CONFIG = {
    files: TS_FILES,
    languageOptions: {
        ...BASE_LANGUAGE_OPTIONS,
        parser: tseslint.parser,
        globals: {
            ...BASE_GLOBALS,
            NodeJS: true,
            JSX: "readonly"
        },
        parserOptions: {
            projectService: true,
            ecmaFeatures: {
                jsx: true
            }
        }
    },
    plugins: {
        "@typescript-eslint": tseslint.plugin,
        ...SHARED_PLUGINS
    },
    settings: SHARED_SETTINGS,
    rules: {
        ...STYLE_RULES,
        ...JS_RULES,
        ...TS_RULES,
        "n/no-missing-import": "off",
        "n/no-missing-require": "off"
    }
};

// ------------------------------------------------------------------------------------------
// Test files config (Jest globals and recommended rules)
// ------------------------------------------------------------------------------------------
export const TEST_CONFIG = {
    files: TEST_FILES,
    plugins: {
        jest: fixupPluginRules(jest),
        jasmine: fixupPluginRules(jasmine)
    },
    languageOptions: {
        globals: { ...globals.jest, ...globals.jasmine }
    },
    rules: TEST_RULES
};


export const OVERRIDES = [
    {
        files: ["**/scripts/**/*"],
        rules: {
            "no-console": "off"
        }
    }
];

// endregion config

export default [
    IGNORE_CONFIG,
    JS_CONFIG,
    TS_CONFIG,
    TEST_CONFIG,
    ...OVERRIDES
];
