export default [{
  ignores: ["dist"],
  files: ["src/**/*.{js,jsx}", "tests/**/*.{js,jsx}"],
  languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z_]" }] }
}];
