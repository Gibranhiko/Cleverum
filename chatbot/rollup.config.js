import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

export default {
  input: 'chatbotServer.ts',
  output: {
    file: 'dist/app.cjs',
    format: 'cjs',
  },
  plugins: [
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
    json(),
  ],
  external: [
    'fs', 'path', 'http', 'url', 'dotenv/config', 'openai', '@builderbot/bot', '@builderbot/provider-baileys', 'date-fns'
  ]
};
