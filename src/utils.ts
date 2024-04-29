import dayjs from 'dayjs'

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function log(...data: string[]) {
  console.log(`[${dayjs().format('HH:mm:ss.SSS')}]`, ...data)
}

export function mix<T extends any[]>(arr: Readonly<T>) {
  const mixed = [ ...arr ] as T
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ mixed[i], mixed[j] ] = [ mixed[j], mixed[i] ]
  }
  return mixed
}

export function pinch<T extends any[]>(arr: Readonly<T>): T[number] {
  return mix(arr)[0]
}
