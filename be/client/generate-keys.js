const { ec: EC } = require('elliptic');

const ec = new EC('secp256k1');
const keyPair = ec.genKeyPair();

const publicKey = keyPair.getPublic('hex');
const privateKey = keyPair.getPrivate('hex');

console.log('Public Key (account):', publicKey);
console.log('Private Key (keep secret):', privateKey);
