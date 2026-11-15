// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid/configs/typescript";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  solid,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Lowercase handlers like `onclick` are intentional: they attach native listeners rather
      // than using Solid's event delegation.
      "solid/event-handlers": ["warn", { ignoreCase: true }],
    },
  },
);
