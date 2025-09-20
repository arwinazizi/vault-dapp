import { useEffect, useMemo, useState } from 'react';
import { ethers, formatUnits, formatEther } from 'ethers';

const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;
const VAULT_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawAll',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Withdrew',
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    anonymous: false,
  },
];



export default function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [vaultWei, setVaultWei] = useState('0');
  const [vaultGwei, setVaultGwei] = useState('0');
  const [vaultEth, setVaultEth] = useState('0');
  const [walletWei, setWalletWei] = useState('0');
  const [walletGwei, setWalletGwei] = useState('0');
  const [walletEth, setWalletEth] = useState('0');
  const [status, setStatus] = useState('');
  const [depositAmt, setDepositAmt] = useState('0.01');
  const [withdrawAmt, setWithdrawAmt] = useState('0.005');
  const [vaultTVL, setVaultTVL] = useState('0');
  const [pending, setPending] = useState(false);
  const [lastTx, setLastTx] = useState(null);


  const contract = useMemo(
    () =>
      signer ? new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer) : null,
    [signer]
  );

  async function ensureSepolia(p) {
    const net = await p.getNetwork();
    if (net.chainId !== 11155111n) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      });
    }
  }

  async function connect() {
    if (!window.ethereum) {
      alert('Install MetaMask');
      return;
    }
    const p = new ethers.BrowserProvider(window.ethereum);
    await p.send('eth_requestAccounts', []);
    await ensureSepolia(p);
    const s = await p.getSigner();
    setProvider(p);
    setSigner(s);
    setAccount(await s.getAddress());
  }

  async function refresh() {
    if (!provider || !account) return;
    setStatus('Loading...');
    try {
      // wallet balance
      const w = await provider.getBalance(account);
      setWalletWei(w.toString());
      setWalletGwei(formatUnits(w, 'gwei'));
      setWalletEth(formatEther(w));

      // vault balance
      if (contract) {
        // User wallets vault balance
        const v = await contract.balanceOf(account);
        setVaultWei(v.toString());
        setVaultGwei(formatUnits(v, 'gwei'));
        setVaultEth(formatEther(v));
        // Vault total balance (TVL)
        const tvl = await provider.getBalance(VAULT_ADDRESS);
        setVaultTVL(ethers.formatEther(tvl));
      }
    } catch (e) {
      setStatus(e.shortMessage || e.message);
      return;
    }
    setStatus('');
  }

  async function doDeposit() {
    try {
      if (!contract) return;
      setPending(true); setStatus('Depositing...');
      const tx = await contract.deposit({
        value: ethers.parseEther(depositAmt),
      });
      setLastTx(tx.hash); 
      const rec = await tx.wait();
      await tx.wait();
      setStatus(`Deposited ${depositAmt} ETH`);
      await refresh();
    } catch (e) {
      setStatus(e.shortMessage || e.message || 'Deposit failed');
    } finally {
      setPending(false); 
    }
  }

  async function doWithdraw() {
    try {
      if (!contract) return;
      setPending(true); setStatus('Withdrawing...');
      const tx = await contract.withdraw(ethers.parseEther(withdrawAmt));
      await tx.wait();
      setStatus(`Withdrew ${withdrawAmt} ETH`);
      await refresh();
    } catch (e) {
      setStatus(e.shortMessage || e.message || 'Withdraw failed');
    } finally {
      setPending(false); 
    }
  }

  async function doWithdrawAll() {
    try {
      if (!contract) return;
      setPending(true); setStatus('Withdrawing all...');
      const tx = await contract.withdrawAll();
      await tx.wait();
      setStatus('Withdrew all');
      await refresh();
    } catch (e) {
      setStatus(e.shortMessage || e.message || 'Withdraw all failed');
    } finally {
      setPending(false); 
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    const onAcc = () =>
      connect()
        .then(refresh)
        .catch(() => {});
    const onChain = () =>
      connect()
        .then(refresh)
        .catch(() => {});
    window.ethereum.on?.('accountsChanged', onAcc);
    window.ethereum.on?.('chainChanged', onChain);
    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAcc);
      window.ethereum.removeListener?.('chainChanged', onChain);
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [contract, account]);

  useEffect(() => {
    if (!contract) return;

    // Refresh on any vault state change (tvl changes even when others interact)
    const onDeposited = (user, amount) => {
      // Optional: only refresh UI-heavy parts if it’s your address
      // if (user.toLowerCase() === account.toLowerCase()) { ... }
      refresh();
    };

    const onWithdrew = (user, amount) => {
      refresh();
    };

    contract.on('Deposited', onDeposited);
    contract.on('Withdrew', onWithdrew);

    // Cleanup on unmount / contract change
    return () => {
      contract.off('Deposited', onDeposited);
      contract.off('Withdrew', onWithdrew);
    };
  }, [contract, account]); // re-bind if wallet/contract changes

  useEffect(() => {
    if (!provider) return;
    const onBlock = () => refresh();
    provider.on('block', onBlock);
    return () => provider.off('block', onBlock);
  }, [provider]);

  const fmt = (n) => {
    try {
      return Number(n).toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch {
      return n;
    }
  };


  return (
    <div className='min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl bg-gray-900/70 backdrop-blur rounded-2xl shadow-2xl border border-white/10'>
        {/* Header */}
        <div className='px-6 pt-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-semibold tracking-tight'>
                Vault dApp
              </h1>
              <p className='text-xs text-gray-400 mt-1'>
                Network: Sepolia · Contract:{' '}
                <span className='font-mono'>
                  {(import.meta.env.VITE_VAULT_ADDRESS || '').slice(0, 6)}…
                  {(import.meta.env.VITE_VAULT_ADDRESS || '').slice(-4)}
                </span>
              </p>
            </div>
            {!account ? (
              <button
                onClick={connect}
                className='inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium transition'
              >
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className='text-right'>
                <p className='text-xs text-gray-400'>Connected</p>
                <p className='font-mono text-xs max-w-[220px] truncate'>
                  {account}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className='p-6'>
          {account && (
            <>
              {/* Stats grid */}
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                <div className='rounded-xl border border-white/10 bg-black/20 p-4'>
                  <p className='text-xs text-gray-400'>Wallet ETH</p>
                  <p className='mt-1 text-xl font-semibold'>{fmt(walletEth)}</p>
                </div>
                <div className='rounded-xl border border-white/10 bg-black/20 p-4'>
                  <p className='text-xs text-gray-400'>Your Vault (ETH)</p>
                  <p className='mt-1 text-xl font-semibold'>{fmt(vaultEth)}</p>
                  <p className='mt-1 text-[10px] text-gray-500 font-mono break-all'>
                    {vaultWei} wei
                  </p>
                </div>
                <div className='rounded-xl border border-amber-500/30 bg-amber-500/10 p-4'>
                  <p className='text-xs text-amber-300'>Vault TVL (ETH)</p>
                  <p className='mt-1 text-xl font-semibold text-amber-200'>
                    {fmt(vaultTVL)}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className='h-px bg-white/10 my-6' />

              {/* Actions */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {/* Deposit card */}
                <div className='rounded-xl border border-white/10 bg-black/20 p-4'>
                  <p className='text-sm font-medium mb-2'>Deposit</p>
                  <div className='flex gap-2'>
                    <input
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(e.target.value)}
                      inputMode='decimal'
                      placeholder='0.01'
                      className='flex-1 bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-mono text-sm'
                    />
                    <button
                      onClick={doDeposit}
                      disabled={pending || !depositAmt}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition
                      ${
                        pending
                          ? 'bg-blue-900 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {pending ? 'Pending…' : 'Deposit'}
                    </button>
                  </div>
                  <p className='text-[11px] text-gray-500 mt-2'>
                    Sends ETH to <span className='font-mono'>deposit()</span>
                  </p>
                </div>

                {/* Withdraw card */}
                <div className='rounded-xl border border-white/10 bg-black/20 p-4'>
                  <p className='text-sm font-medium mb-2'>Withdraw</p>
                  <div className='flex gap-2'>
                    <input
                      value={withdrawAmt}
                      onChange={(e) => setWithdrawAmt(e.target.value)}
                      inputMode='decimal'
                      placeholder='0.005'
                      className='flex-1 bg-gray-900/80 border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 font-mono text-sm'
                    />
                    <button
                      onClick={doWithdraw}
                      disabled={pending || !withdrawAmt}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition
                      ${
                        pending
                          ? 'bg-emerald-900 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {pending ? 'Pending…' : 'Withdraw'}
                    </button>
                  </div>
                  <button
                    onClick={doWithdrawAll}
                    disabled={pending}
                    className={`mt-2 w-full py-2 rounded-lg text-sm font-medium transition
                    ${
                      pending
                        ? 'bg-emerald-900 cursor-not-allowed'
                        : 'bg-emerald-700/80 hover:bg-emerald-600'
                    }`}
                  >
                    {pending ? 'Pending…' : 'Withdraw All'}
                  </button>
                  <p className='text-[11px] text-gray-500 mt-2'>
                    Pulls your full balance from the Vault
                  </p>
                </div>
              </div>

              {/* Footer status */}
              {status && (
                <div className='mt-6 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-300'>
                  {status}
                </div>
              )}
            </>
          )}

          {!account && (
            <p className='mt-6 text-center text-sm text-gray-400'>
              Connect your wallet to view balances and interact with the Vault.
            </p>
          )}
        </div>
      </div>
    </div>
  );


  // return (
  //   <div style={{ padding: 20 }}>
  //     <h1>Vault Frontend</h1>
  //     <h3>Vault Total Value Locked (TVL)</h3>
  //     <p>{vaultTVL} ETH</p>
  //     {!account ? (
  //       <button onClick={connect}>Connect Wallet</button>
  //     ) : (
  //       <>
  //         <p>
  //           <b>Account:</b> {account}
  //         </p>
  //         <button onClick={refresh}>Refresh</button>
  //         <h3>Wallet (MetaMask) Balance</h3>
  //         <ul>
  //           <li>
  //             <b>Wei:</b> {walletWei}
  //           </li>
  //           <li>
  //             <b>Gwei:</b> {walletGwei}
  //           </li>
  //           <li>
  //             <b>ETH:</b> {walletEth}
  //           </li>
  //         </ul>

  //         <h3>Your Vault Balance</h3>
  //         <ul>
  //           <li>
  //             <b>Wei:</b> {vaultWei}
  //           </li>
  //           <li>
  //             <b>Gwei:</b> {vaultGwei}
  //           </li>
  //           <li>
  //             <b>ETH:</b> {vaultEth}
  //           </li>
  //         </ul>

  //         <h3>Deposit into vault</h3>
  //         <input
  //           value={depositAmt}
  //           onChange={(e) => setDepositAmt(e.target.value)}
  //           style={{ marginRight: 8 }}
  //         />
  //         <button onClick={doDeposit}>Deposit</button>

  //         <h3>Withdraw from vault</h3>
  //         <input
  //           value={withdrawAmt}
  //           onChange={(e) => setWithdrawAmt(e.target.value)}
  //           style={{ marginRight: 8 }}
  //         />
  //         <button onClick={doWithdraw}>Withdraw</button>

  //         <div style={{ marginTop: 12 }}>
  //           <button onClick={doWithdrawAll}>Withdraw All</button>
  //         </div>

  //         <p>
  //           <i>{status}</i>
  //         </p>
  //         <p>Contract: {VAULT_ADDRESS}</p>
  //       </>
  //     )}
  //   </div>
  // );

}
