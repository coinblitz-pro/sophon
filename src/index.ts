import dayjs from 'dayjs'
import { AbiCoder, ethers, formatEther, JsonRpcProvider, parseEther, parseUnits, TransactionResponse } from 'ethers'
import { abis } from './constants'
import { log, sleep } from './utils'


const provider = new JsonRpcProvider('https://mainnet.era.zksync.io')
const multicall = new ethers.Contract('0xF9cda624FBC7e059355ce98a31693d299FACd963', abis.multicall3, provider)

const shops = [
  { address: '0xc9110f53c042a61d1b0f95342e61d62714f8a2e6', price: parseEther('0.0813'), allocation: parseEther('162'), available: true },
  { address: '0x11b2669a07a0d17555a7ab54c0c37f5c8655a739', price: parseEther('0.0915'), allocation: parseEther('183'), available: true },
  { address: '0x58078e429a99478304a25b2ab03abe79199be618', price: parseEther('0.1030'), allocation: parseEther('257'), available: true },
  { address: '0x2e89cae8f6532687b015f4ba320f57c77920b451', price: parseEther('0.1158'), allocation: parseEther('361'), available: true },
  { address: '0x396ea0670e3112bc344791ee7931a5a55e0bdbd1', price: parseEther('0.1303'), allocation: parseEther('407'), available: true },
]

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    log('📝 usage: npm start <max_tier_to_bay> <amount_to_bay> <keys_separated_by_comma>')
    log('          npm start 1 10 0x,0x')
    return
  }

  const maxTier = parseInt(args[0])
  const amount = BigInt(args[1])
  const keys = args[2]

  observe().then(() => console.log('👀 start observing'))
  await Promise.all(keys.split(',').map(key => worker(key, maxTier, amount)))
}

async function observe() {
  while (dayjs().isBefore('2024-04-30T10:59:00+02:00')) {
    await sleep(1000)
  }

  while (true) {
    await sleep(32)

    const data: [] = await multicall.aggregate3.staticCall(shops.map(shop => ({ target: shop.address, allowFailure: true, callData: '0x1d6a4581' })))
    for (let i = 0; i < data.length; i++) {
      const shop = shops[i]
      shop.available = BigInt(data[i][1]) < shop.allocation
    }

    setTimeout(() => log('👀 available tiers:', shops.filter(shop => shop.available).map(shop => shops.indexOf(shop) + 1).join(', ') || 'none'), 0)
  }
}

async function worker(key: string, maxTier: number, amount: bigint) {
  const coder = AbiCoder.defaultAbiCoder()
  const signer = new ethers.Wallet(key).connect(provider)

  const WETH = new ethers.Contract('0x5aea5775959fbc2557cc8789bc1bf90a239d9a91', abis.erc20, signer)
  const balance = await WETH.balanceOf(signer.address)
  if (balance < shops[maxTier - 1].price * amount) {
    console.error(`❌ not enough WETH for x${amount} tier.${maxTier} (${formatEther(shops[maxTier - 1].price)} ETH)`)
    return
  }

  for (let i = 0; i < maxTier; i++) {
    const shop = shops[i]
    const required = shop.price * amount
    const allowance = await WETH.allowance(signer.address, shop.address)
    if (allowance < required) {
      log(`🔐 approving tier.${i + 1} shop ${shop.address}`)
      const tx: TransactionResponse = await WETH.approve(shop.address, required)
      await tx.wait()
      log(`🔓 approved by https://era.zksync.network/tx/${tx.hash}`)
    }
  }

  const border = dayjs('2024-04-30T10:59:00+02:00')
  while (dayjs().isBefore(border)) {
    process.stdout.write(`\r⏳ waiting for the start... ${border.diff(dayjs(), 'second')}s`)
    await sleep(100)
  }

  let nonce = await signer.getNonce()
  const allocation = parseEther('1') * amount
  const gasLimit = 1000000
  const gasPrice = parseUnits('5.051', 'gwei')
  const startedAt = dayjs('2024-04-30T10:59:59+02:00').unix() * 1000 + 500

  while (true) {
    if (Date.now() < startedAt) {
      await sleep(1)
      continue
    }

    for (let i = 0; i < maxTier; i++) {
      const shop = shops[i]
      const price = shop.price * amount

      if (shop.available === false) {
        if (i === maxTier - 1) {
          log(`❌ all tiers are sold out`)
          return
        }
        continue
      }

      try {
        const data = '0x2316448c' + coder.encode([ 'uint256', 'bytes32[]', 'uint256' ], [ price, [], allocation ]).slice(2)
        const tx = await signer.sendTransaction({ to: shop.address, data, nonce, gasLimit, gasPrice })
        log(`💸 attempted to buy tier.${i + 1} by https://era.zksync.network/tx/${tx.hash}`)
        await tx.wait()
        log(`💰 successfully bought`)
        return
      } catch (e) {
        log('❌ failed to buy, next attempt', e)
        nonce += 1
        break
      }
    }
  }
}

main()
