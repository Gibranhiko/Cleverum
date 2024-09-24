import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/app.ts',
  output: {
    file: 'dist/app.js',
    format: 'cjs',  // CommonJS format for Node.js
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
  ],
  external: [
    'fs', 'path', 'http', 'url', 'dotenv/config', 'express', 'socket.io', 
    'mongoose', 'openai', '@builderbot/bot', '@builderbot/provider-baileys', 
    'axios', 'date-fns', 'date-fns-tz', 'date-fns/locale', 'next',
  ],
};
