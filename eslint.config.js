// @ts-check

import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/",
      "build/",
      "public/",
      ".sst/",
      "sst.config.ts",
      "sst-env.d.ts",
      "eslint.config.js",
      "packages/*/node_modules/",
      "packages/*/build/",
      "packages/*/dist/",
      "packages/*/sst-env.d.ts",
    ],
  },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "prettier.config.js",
            "packages/functions/__mocks__/fs/fs.cjs",
            "packages/functions/__mocks__/fs/promises.cjs",
          ],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "no-console": ["error", { allow: ["error", "warn", "info"] }],
      "object-shorthand": ["error", "always"],
      "no-useless-rename": [
        "error",
        {
          ignoreDestructuring: false,
          ignoreImport: false,
          ignoreExport: false,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },
  prettierConfig,
];
