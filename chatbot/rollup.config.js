import typescript from 'rollup-plugin-typescript2'

export default {
  input: 'chatbotServer.ts',
  output: {
    file: 'dist/app.js',
    format: 'esm',
  },
  external: ['googleapis', 'openai', 'mongoose', 'express', 'google-auth-library'],
  onwarn: (warning) => {
    if (warning.code === 'UNRESOLVED_IMPORT') return
  },
  plugins: [typescript()],
}
