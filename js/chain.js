// Bloomly ↔ BOT Chain. Only the anonymous check-in and streak reads live here.
// No health data is ever passed to any function in this file.
'use strict';

(function () {
  const B = window.Bloomly;
  const CFG = window.BLOOMLY_CONFIG;
  const netKey = new URLSearchParams(location.search).get('net') === 'testnet' ? 'testnet' : 'mainnet';
  const NET = CFG.networks[netKey];
  B.NET = NET;
  B.NET_KEY = netKey;

  const ABI = [
    'function checkIn()',
    'function getStreak(address user) view returns (uint32 current, uint32 best, uint32 total, uint32 lastDay)',
    'function stats() view returns (uint256 members, uint256 totalCheckIns)',
    'event CheckedIn(address indexed user, uint256 day, uint32 current)',
    'event Milestone(address indexed user, uint32 streakDays)'
  ];
  const hexId = '0x' + NET.chainId.toString(16);

  const chain = (B.chain = {
    address: null,
    chainOk: null, // true / false / null (unknown)
    streak: null, // { current, best, total, lastDay }
    busy: false,
    hasWallet: () => !!window.ethereum,
    configured: () => /^0x[0-9a-fA-F]{40}$/.test(NET.contract || ''),
    explorerAddress: (a) => `${NET.explorer}/address/${a}`,
    short: (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  });

  const listeners = new Set();
  chain.on = (fn) => listeners.add(fn);
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  /* ---- Derived streak state ---- */
  chain.checkedInToday = () => !!(chain.streak && chain.streak.lastDay === B.utcDay());
  chain.isBroken = () => !!(chain.streak && chain.streak.total > 0 && chain.streak.lastDay < B.utcDay() - 1);
  chain.currentStreak = () => (chain.streak && !chain.isBroken() ? chain.streak.current : 0);

  /* ---- Network ---- */
  async function checkNetwork() {
    if (!window.ethereum) { chain.chainOk = null; return; }
    try {
      const id = await window.ethereum.request({ method: 'eth_chainId' });
      chain.chainOk = parseInt(id, 16) === NET.chainId;
    } catch (e) { chain.chainOk = null; }
  }

  chain.switchNetwork = async () => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
    } catch (e) {
      const code = e && (e.code ?? (e.data && e.data.originalError && e.data.originalError.code));
      if (code === 4902 || /unrecognized chain|not been added/i.test((e && e.message) || '')) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: hexId, chainName: NET.name, rpcUrls: [NET.rpc], nativeCurrency: NET.currency, blockExplorerUrls: [NET.explorer] }]
        });
      } else {
        throw e;
      }
    }
    await checkNetwork();
    emit();
    return chain.chainOk;
  };

  /* ---- Wallet ---- */
  chain.connect = async () => {
    if (!window.ethereum) return false;
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    chain.address = accounts[0] || null;
    await checkNetwork();
    emit();
    if (chain.address && !chain.chainOk) {
      try { await chain.switchNetwork(); } catch (e) { /* the user can switch later */ }
    }
    await chain.refresh();
    return !!chain.address;
  };

  function reader() {
    if (!window.ethers) throw new Error('ethers not loaded');
    if (window.ethereum && chain.chainOk) return new ethers.BrowserProvider(window.ethereum);
    return new ethers.JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: true });
  }

  chain.refresh = async () => {
    if (!chain.configured() || !chain.address || !window.ethers) { emit(); return; }
    try {
      const c = new ethers.Contract(NET.contract, ABI, reader());
      const r = await c.getStreak(chain.address);
      chain.streak = { current: Number(r[0]), best: Number(r[1]), total: Number(r[2]), lastDay: Number(r[3]) };
    } catch (e) {
      console.warn('Could not read streak', e);
    }
    emit();
  };

  chain.stats = async () => {
    if (!chain.configured() || !window.ethers) return null;
    const c = new ethers.Contract(NET.contract, ABI, new ethers.JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: true }));
    const r = await c.stats();
    return { members: Number(r[0]), total: Number(r[1]) };
  };

  // Sends checkIn(). Calls onStage('wallet' | 'pending') as it goes. Returns the new streak.
  chain.checkIn = async (onStage) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const c = new ethers.Contract(NET.contract, ABI, signer);
    onStage && onStage('wallet');
    const tx = await c.checkIn();
    onStage && onStage('pending', tx.hash);
    await tx.wait();
    await chain.refresh();
    return chain.streak;
  };

  chain.errorKind = (e) => {
    const code = e && (e.code ?? (e.info && e.info.error && e.info.error.code));
    const msg = ((e && (e.shortMessage || e.reason || e.message)) || '').toString();
    if (code === 'ACTION_REJECTED' || code === 4001 || /user (rejected|denied)/i.test(msg)) return 'rejected';
    if (/already checked in/i.test(msg)) return 'already';
    if (/insufficient funds/i.test(msg)) return 'funds';
    return 'failed';
  };

  /* ---- Start-up: reconnect silently if already authorised ---- */
  chain.init = async () => {
    if (!window.ethereum) { emit(); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      chain.address = accounts[0] || null;
    } catch (e) { /* ignore */ }
    await checkNetwork();
    emit();
    if (chain.address) chain.refresh();
    window.ethereum.on && window.ethereum.on('accountsChanged', (acc) => {
      chain.address = acc[0] || null;
      chain.streak = null;
      emit();
      chain.refresh();
    });
    window.ethereum.on && window.ethereum.on('chainChanged', async () => {
      await checkNetwork();
      emit();
      chain.refresh();
    });
  };
})();
