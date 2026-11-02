import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
export default [
  ...compat.extends("eslint:recommended"),
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: { "@typescript-eslint/no-explicit-any": "off" }
  },
  { ignores: ["dist/**", "node_modules/**"] }
];
