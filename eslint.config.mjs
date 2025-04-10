import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Ignore auto-generated Supabase types file
    ignores: ["src/lib/database.types.ts"]
  },
  {
    files: ["src/app/api/**/*.ts"],
    rules: {
      // Allow more flexible error handling in API routes
      "@typescript-eslint/no-explicit-any": "warn",  // Downgrade to warning
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",   // Ignore vars starting with underscore
        "varsIgnorePattern": "^_" 
      }]
    }
  }
];

export default eslintConfig;
