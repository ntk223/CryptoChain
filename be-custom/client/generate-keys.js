const customCrypto = require('../src/utils/customCrypto');

const { privateKey, publicKey } = customCrypto.generateKeyPair(false);

console.log('Public Key (account):', publicKey);
console.log('Private Key (keep secret):', privateKey);
