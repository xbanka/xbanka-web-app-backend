function validateCryptoAddress(address: string, network: string): boolean {
  const patterns = {
    'BITCOIN': /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/,
    'ERC20': /^0x[a-fA-F0-9]{40}$/,
    'TRC20': /^T[a-zA-Z0-9]{33}$/,
    'BEP20': /^0x[a-fA-F0-9]{40}$/,
  };

  const pattern = patterns[network.toUpperCase()];
  if (!pattern) return true;
  return pattern.test(address);
}

async function testValidation() {
  console.log('🧪 Testing Address Validation...');
  
  const testCases = [
    { addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', net: 'BITCOIN', expected: true },
    { addr: 'invalid-btc', net: 'BITCOIN', expected: false },
    { addr: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', net: 'ERC20', expected: true },
    { addr: '0xinvalid-eth', net: 'ERC20', expected: false },
    { addr: 'TR7NHqjiSZTp6uu3rpkDxJFCH8L7Lx2puz', net: 'TRC20', expected: true },
    { addr: 'Tinvalid-trc', net: 'TRC20', expected: false },
  ];

  for (const t of testCases) {
    const res = validateCryptoAddress(t.addr, t.net);
    console.log(`${res === t.expected ? '✅' : '❌'} ${t.net}: ${t.addr} -> ${res}`);
  }
}

async function main() {
  await testValidation();
  process.exit();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
