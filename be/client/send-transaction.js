const { ec: EC } = require('elliptic');

const { buildTransactionPayload, calculateTransactionHash } = require('../src/domain/transaction');
const {getUserById} = require('../src/repositories/userRepository');
const {getUserById} = require('../src/repositories/userRepository');

const ec = new EC('secp256k1');

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
  const user1 = await getUserById(1);
  const user2 = await getUserById(2);

  // const [, , senderPrivateKey, recipientPublicKey, amount, apiUrl = 'http://localhost:3000'] =
  //   process.argv;
  const senderPrivateKey = user1.privateKey;
  if (!senderPrivateKey || !recipientPublicKey || !amount) {
    printUsage();
    process.exit(1);
  }

  let payload;
  try {
    const key = ec.keyFromPrivate(senderPrivateKey, 'hex');
    const senderPublicKey = key.getPublic('hex');

    payload = buildTransactionPayload({
      senderPublicKey,
      recipient: recipientPublicKey,
      amount,
    });

    const transactionHash = calculateTransactionHash(payload);
    const signature = key.sign(transactionHash, 'hex').toDER('hex');

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
