import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';  // Import JSON plugin

export default {
  input: 'chatbotServer.ts',
  output: {
    file: 'dist/app.cjs',
    format: 'cjs',
  },
  context: 'globalThis',	
  plugins: [
    json(),  // Add JSON plugin here to handle package.json files
    resolve({
      preferBuiltins: true,
      extensions: ['.js', '.ts'],
    }),
    commonjs(),
    typescript({
      tsconfig: 'tsconfig.json',
      useTsconfigDeclarationDir: true,
      clean: true,
    }),
  ],
  external: [
    'fs', 'path', 'http', 'url', 'dotenv/config', '@builderbot/bot', '@builderbot/provider-baileys', 'date-fns'
  ]
};
