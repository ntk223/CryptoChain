const customCrypto = require('../src/utils/customCrypto');
const { buildTransactionPayload, calculateTransactionHash } = require('../src/domain/transaction');

function printUsage() {
  console.log(
    'Usage: node client/send-transaction.js <senderPrivateKey> <recipientPublicKey> <amount> [apiUrl]'
  );
}

async function sendTransaction(apiUrl, body) {
  const response = await fetch(`${apiUrl}/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const message = data.message || response.statusText;
    console.error('Server error:', message);
    process.exit(1);
  }

  console.log('Server response:', data);
}

async function main() {
  const [, , senderPrivateKey, recipientPublicKey, amount, apiUrl = 'http://localhost:3002'] = process.argv;
  if (!senderPrivateKey || !recipientPublicKey || !amount) {
    printUsage();
    process.exit(1);
  }

  let payload;
  try {
    // Derive public key from private key
    const P = customCrypto.pointMultiply(BigInt('0x' + senderPrivateKey), customCrypto.G);
    const senderPublicKey = customCrypto.serializePublicKey(P, false);

    payload = buildTransactionPayload({
      senderPublicKey,
      recipient: recipientPublicKey,
      amount,
    });

    const transactionHash = calculateTransactionHash(payload);
    const signature = customCrypto.sign(transactionHash, senderPrivateKey);

    await sendTransaction(apiUrl, {
      ...payload,
      signature,
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
