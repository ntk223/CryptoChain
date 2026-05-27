const customCrypto = require('../src/utils/customCrypto');

function runTests() {
  console.log('--- RUNNING CUSTOM CRYPTO TESTS ---');

  // Test 1: G point coordinates
  console.log('Test 1: Generator Point G coordinates match secp256k1 definition');
  const G = customCrypto.G;
  console.log('G_x:', G[0].toString(16));
  console.log('G_y:', G[1].toString(16));
  if (G[0] === 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n) {
    console.log('  -> PASS');
  } else {
    console.error('  -> FAIL: G_x is incorrect');
  }

  // Test 2: Point Multiply (1 * G = G)
  console.log('\nTest 2: pointMultiply(1, G) = G');
  const G1 = customCrypto.pointMultiply(1n, G);
  if (G1 !== null && G1[0] === G[0] && G1[1] === G[1]) {
    console.log('  -> PASS');
  } else {
    console.error('  -> FAIL');
  }

  // Test 3: Key pair generation and derivation
  console.log('\nTest 3: Keypair Generation & Derivation');
  const { privateKey, publicKey } = customCrypto.generateKeyPair(false);
  console.log('Generated Private Key:', privateKey);
  console.log('Generated Public Key:', publicKey);
  if (publicKey.startsWith('04') && publicKey.length === 130) {
    console.log('  -> PASS: Correct uncompressed format');
  } else {
    console.error('  -> FAIL: Incorrect public key format');
  }

  // Test 4: Compressed Key Generation and Parsing
  console.log('\nTest 4: Compressed Public Key Generation and Parsing');
  const keysComp = customCrypto.generateKeyPair(true);
  console.log('Compressed Public Key:', keysComp.publicKey);
  if (keysComp.publicKey.length === 66 && (keysComp.publicKey.startsWith('02') || keysComp.publicKey.startsWith('03'))) {
    try {
      const parsedPoint = customCrypto.parsePublicKey(keysComp.publicKey);
      const reSerialized = customCrypto.serializePublicKey(parsedPoint, true);
      if (reSerialized === keysComp.publicKey) {
        console.log('  -> PASS: Reconstructed compressed public key perfectly');
      } else {
        console.error('  -> FAIL: Serialized point does not match');
      }
    } catch (e) {
      console.error('  -> FAIL:', e.message);
    }
  } else {
    console.error('  -> FAIL: Compressed public key is invalid');
  }

  // Test 5: Sign & Verify
  console.log('\nTest 5: Sign & Verify a transaction hash');
  const msg = 'hello bitcoin blockchain with secp256k1';
  const msgHash = customCrypto.sha256(msg);
  console.log('Message Hash:', msgHash);

  const sig = customCrypto.sign(msgHash, privateKey);
  console.log('Generated DER Signature:', sig);

  const isValid = customCrypto.verify(msgHash, sig, publicKey);
  console.log('Signature is valid?', isValid);
  if (isValid) {
    console.log('  -> PASS');
  } else {
    console.error('  -> FAIL');
  }

  // Test 6: Verify invalid signature fails
  console.log('\nTest 6: Verify invalid signature or hash fails');
  const badHash = customCrypto.sha256('different message');
  const isBadHashValid = customCrypto.verify(badHash, sig, publicKey);
  const badSig = sig.slice(0, -2) + '00'; // actually alters the signature
  const isBadSigValid = customCrypto.verify(msgHash, badSig, publicKey);

  if (!isBadHashValid && !isBadSigValid) {
    console.log('  -> PASS');
  } else {
    console.error('  -> FAIL');
  }

  console.log('\n--- TESTS COMPLETED ---');
}

runTests();
