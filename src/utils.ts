import dayjs from 'dayjs'

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function log(...data: string[]) {
  console.log(`[${dayjs().format('HH:mm:ss.SSS')}]`, ...data)
}
