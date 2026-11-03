// Bloomly configuration.
// After deploying contracts/BloomlyStreak.sol in Remix, paste the address below.
// Open the site with ?net=testnet to use the testnet entry instead of mainnet.
window.BLOOMLY_CONFIG = {
  networks: {
    mainnet: {
      chainId: 677,
      name: 'BOT Chain',
      rpc: 'https://rpc.botchain.ai',
      explorer: 'https://scan.botchain.ai',
      currency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
      contract: '0x3f44875d5876b3f88687AA534cB955d276D1eAb8' // BloomlyStreak on BOT Chain mainnet
    },
    testnet: {
      chainId: 968,
      name: 'BOT Chain Testnet',
      rpc: 'https://rpc.bohr.life',
      explorer: 'https://scan.bohr.life',
      currency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
      contract: '' // ← testnet BloomlyStreak address
    }
  },
  repoUrl: 'https://github.com/lallinanoi99-dev/Bloomly' // shown in the footer
};
