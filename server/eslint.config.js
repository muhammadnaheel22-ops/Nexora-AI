import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly", fetch: "readonly", setTimeout: "readonly" } },
    rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] },
  },
];
