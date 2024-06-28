import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { dts } from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

const packageJson = require("./package.json");

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.exports["."].require,
        format: "cjs",
        sourcemap: true,
        exports: 'named',
      },
      {
        file: packageJson.exports["."].import,
        format: "esm",
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      resolve({ preferBuiltins: true }), // This tells the plugin to prefer built-in modules (like 'path') over local ones
      commonjs(),
      terser(),
    ],
    external: [
      'child_process',
      'fs',
      'path',
      'util',
      'os',
    ],
  },
  {
    input: "src/index.ts",
    output: [{ file: packageJson.exports["."].types, format: "es" }],
    plugins: [dts()],
    external: [
      'child_process',
      'fs',
      'path',
      'util',
      'os',
    ],
  },
  {
    input: 'matchers/jest.ts',
    output: [
      {
        file: packageJson.exports["./jest/extend"].require,
        format: "cjs",
        sourcemap: true,
        exports: 'named',
      },
      {
        file: packageJson.exports["./jest/extend"].import,
        format: "esm",
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      resolve({ preferBuiltins: true }), // This tells the plugin to prefer built-in modules (like 'path') over local ones
      commonjs(),
      terser(),
    ],
    external: ['jest'],
  },
  {
    input: "matchers/jest.ts",
    output: [{ file: packageJson.exports["./jest/extend"].types, format: "es" }],
    plugins: [dts()],
    external: ['jest'],
  },
];