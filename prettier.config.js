// @ts-check

/** @typedef  {import("prettier").Config} PrettierConfig */
/** @typedef  {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type { PrettierConfig | SortImportsConfig } */
const config = {
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "^@repo/(.*)$",
    "^@/(.*)$",
    "^(?!.*[.]css$)[./].*$",
    ".css$",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "4.4.0",
};

export default config;
