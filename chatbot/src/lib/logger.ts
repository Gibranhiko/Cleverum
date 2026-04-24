const isProduction = process.env.NODE_ENV === 'production'

function formatMsg(level: string, msg: string) {
  return `[${new Date().toISOString()}] ${level} ${msg}`
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.log(formatMsg('INFO', msg), ...args)
  },
  warn(msg: string, ...args: unknown[]) {
    console.warn(formatMsg('WARN', msg), ...args)
  },
  error(msg: string, ...args: unknown[]) {
    console.error(formatMsg('ERROR', msg), ...args)
  },
  debug(msg: string, ...args: unknown[]) {
    if (!isProduction) console.log(formatMsg('DEBUG', msg), ...args)
  },
}
