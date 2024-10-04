import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/app.ts',
  output: {
    file: 'dist/app.cjs',
    format: 'cjs',
  },
  plugins: [
    resolve({
      preferBuiltins: true,
      extensions: ['.js'],
    }),
    commonjs(),
    typescript(),
  ],
  external: [
    'fs', 'path', 'http', 'url', 'dotenv/config', 'express', 'socket.io', 
    'mongoose', 'openai', '@builderbot/bot', '@builderbot/provider-baileys', 
    'axios', 'date-fns', 'date-fns/locale', 'next',
  ]
};
