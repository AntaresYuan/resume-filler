const js = require("@eslint/js");
const noUnsanitized = require("eslint-plugin-no-unsanitized");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "assets/**",
      "icons/**",
      "**/*.min.js"
    ]
  },
  js.configs.recommended,
  noUnsanitized.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly"
      }
    }
  },
  {
    files: ["__tests__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    }
  },
  {
    files: ["eslint.config.js", "jest.config.*"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node }
    }
  }
];
