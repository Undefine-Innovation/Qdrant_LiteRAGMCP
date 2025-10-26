module.exports = {
  extends: [
    "@eslint/js/recommended",
    "@typescript-eslint/recommended"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-console": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  env: {
    node: true,
    es2022: true
  }
};