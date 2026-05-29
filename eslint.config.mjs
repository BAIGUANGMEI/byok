import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "drizzle/meta/**"],
  },
];

export default eslintConfig;
