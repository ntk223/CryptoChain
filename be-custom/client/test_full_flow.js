/**
 * Script Test Đầy Đủ Luồng Giao Dịch (E2E Transaction Flow Test)
 * 
 * Luồng hoạt động:
 * 1. Tạo ví người gửi (Flow Sender) qua API POST /wallets
 * 2. Tạo ví người nhận (Flow Recipient) qua API POST /wallets
 * 3. Ký giao dịch trên client sử dụng thư viện tự code (customCrypto)
 *    - Hash: SHA256(senderPublicKey|recipientPublicKey|amount)
 *    - Chữ ký: DER-encoded ECDSA secp256k1 (BIP-146 Low-S canonical)
 * 4. Gửi giao dịch qua API POST /transaction
 * 5. Server xác thực chữ ký (E2E), kiểm tra balance, mine block mới tự động
 * 6. Kiểm tra lại balance cập nhật của cả 2 ví
 * 7. Kiểm tra blockchain explorer qua API GET /chain để xem block mới chứa giao dịch
 */

const crypto = require('crypto');
const customCrypto = require('../src/utils/customCrypto');

const API_URL = 'http://localhost:3003';

async function makeRequest(method, path, body = null) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

async function run() {
  console.log('================================================================');
  console.log('   BẮT ĐẦU LUỒNG KIỂM TRA GIAO DỊCH TOÀN DIỆN (E2E TEST)        ');
  console.log('================================================================\n');

  try {
    // ─── 1. TẠO VÍ NGƯỜI GỬI ───
    console.log('1. Đang tạo ví người gửi (Flow Sender)...');
    const senderRes = await makeRequest('POST', '/wallets', { name: `Flow Sender ${Date.now().toString().slice(-4)}` });
    const sender = senderRes.wallet;
    console.log('   -> Thành công! Ví người gửi:');
    console.log(`      - Tên: ${sender.name}`);
    console.log(`      - Public Key: ${sender.publicKey}`);
    console.log(`      - Private Key: ${sender.privateKey}`);
    console.log(`      - Số dư ban đầu: ${sender.balance} BTC\n`);

    // ─── 2. TẠO VÍ NGƯỜI NHẬN ───
    console.log('2. Đang tạo ví người nhận (Flow Recipient)...');
    const recipientRes = await makeRequest('POST', '/wallets', { name: `Flow Recipient ${Date.now().toString().slice(-4)}` });
    const recipient = recipientRes.wallet;
    console.log('   -> Thành công! Ví người nhận:');
    console.log(`      - Tên: ${recipient.name}`);
    console.log(`      - Public Key: ${recipient.publicKey}`);
    console.log(`      - Số dư ban đầu: ${recipient.balance} BTC\n`);

    // ─── 3. KÝ GIAO DỊCH VÀ HIỂN THỊ CHI TIẾT TOÁN HỌC ───
    const sendAmount = 15.5;
    console.log('================================================================');
    console.log('   THÔNG SỐ TOÁN HỌC ĐƯỜNG CONG SECP256K1 & ECDSA SIGNING');
    console.log('================================================================');
    console.log(`   - Kích thước trường (p): 0x${customCrypto.p.toString(16)}`);
    console.log(`   - Order của nhóm (n)   : 0x${customCrypto.n.toString(16)}`);
    console.log(`   - Điểm cơ sở G (X)     : 0x${customCrypto.G[0].toString(16)}`);
    console.log(`   - Điểm cơ sở G (Y)     : 0x${customCrypto.G[1].toString(16)}`);
    console.log('   -------------------------------------------------------------');

    const d = BigInt('0x' + sender.privateKey);
    const P = customCrypto.pointMultiply(d, customCrypto.G);
    console.log('   - Kiểm tra ánh xạ khóa (Private Key -> Public Key Point):');
    console.log(`     - Khóa bí mật (d)     : 0x${d.toString(16)}`);
    console.log(`     - Tọa độ Public X     : 0x${P[0].toString(16)}`);
    console.log(`     - Tọa độ Public Y     : 0x${P[1].toString(16)}`);
    console.log(`     - Khớp với Public Key : ${customCrypto.serializePublicKey(P) === sender.publicKey ? 'ĐÚNG' : 'SAI'}`);
    console.log('   -------------------------------------------------------------');

    console.log(`   - Ký giao dịch gửi ${sendAmount} BTC:`);
    const msg = `${sender.publicKey}|${recipient.publicKey}|${sendAmount}`;
    const txHash = customCrypto.sha256(msg);
    const e = BigInt('0x' + txHash);
    console.log(`     - Chuỗi message       : "${msg}"`);
    console.log(`     - Hash (e)            : 0x${txHash}`);
    console.log('   -------------------------------------------------------------');

    // Chạy thủ công vòng lặp ký ECDSA để in ra từng bước tính toán
    let k, R, r, kInv, sUnadjusted, s, lowSApplied = false;
    while (true) {
      k = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % customCrypto.n;
      if (k === 0n) continue;

      R = customCrypto.pointMultiply(k, customCrypto.G);
      if (R === null) continue;

      r = R[0] % customCrypto.n;
      if (r === 0n) continue;

      kInv = customCrypto.modInverse(k, customCrypto.n);
      sUnadjusted = (kInv * (e + r * d)) % customCrypto.n;
      if (sUnadjusted === 0n) continue;

      s = sUnadjusted;
      if (s > customCrypto.n / 2n) {
        s = customCrypto.n - s;
        lowSApplied = true;
      }
      break;
    }

    console.log('   - Quy trình ký chi tiết:');
    console.log(`     - Số ngẫu nhiên (k)   : 0x${k.toString(16)}`);
    console.log(`     - Điểm R = k*G (X)    : 0x${R[0].toString(16)}`);
    console.log(`     - Điểm R = k*G (Y)    : 0x${R[1].toString(16)}`);
    console.log(`     - Tham số r (R_x % n) : 0x${r.toString(16)}`);
    console.log(`     - Nghịch đảo k (k^-1) : 0x${kInv.toString(16)}`);
    console.log(`     - Tham số s (chưa chỉnh): 0x${sUnadjusted.toString(16)}`);
    console.log(`     - BIP-146 Low-S Check : ${lowSApplied ? 'Kích hoạt (s > n/2, s = n - s)' : 'Bỏ qua (s <= n/2)'}`);
    console.log(`     - Tham số s (sau chỉnh) : 0x${s.toString(16)}`);

    const signature = customCrypto.toDERSignature(r, s);
    console.log(`     - Chữ ký DER tạo ra   : ${signature}`);
    console.log('   -------------------------------------------------------------');

    console.log('   - Quy trình xác thực chi tiết (Verify):');
    const w = customCrypto.modInverse(s, customCrypto.n);
    const u1 = (e * w) % customCrypto.n;
    const u2 = (r * w) % customCrypto.n;
    const u1G = customCrypto.pointMultiply(u1, customCrypto.G);
    const u2P = customCrypto.pointMultiply(u2, P);
    const RPrime = customCrypto.pointAdd(u1G, u2P);
    console.log(`     - Nghịch đảo s (w)    : 0x${w.toString(16)}`);
    console.log(`     - Hệ số u1 (e * w)    : 0x${u1.toString(16)}`);
    console.log(`     - Hệ số u2 (r * w)    : 0x${u2.toString(16)}`);
    console.log(`     - Điểm R' (X)         : 0x${RPrime[0].toString(16)}`);
    console.log(`     - Điểm R' (Y)         : 0x${RPrime[1].toString(16)}`);
    console.log(`     - R'_x % n === r      : ${RPrime[0] % customCrypto.n === r ? 'HỢP LỆ (BẰNG NHAU)' : 'KHÔNG HỢP LỆ'}`);
    console.log('================================================================\n');

    // ─── 4. GỬI GIAO DỊCH LÊN SERVER ───
    console.log('4. Đang gửi giao dịch lên server...');
    const txPayload = {
      senderPublicKey: sender.publicKey,
      recipient: recipient.publicKey,
      amount: sendAmount,
      signature: signature
    };

    const txResult = await makeRequest('POST', '/transaction', txPayload);
    console.log('   -> Giao dịch hoàn thành thành công!');
    console.log(`      - Tin nhắn từ server: ${txResult.message}`);
    console.log(`      - Block chứa giao dịch: #${txResult.chainLength - 1}`);
    console.log(`      - Block Hash: ${txResult.block.hash}`);
    console.log(`      - Nonce: ${txResult.block.nonce}\n`);

    // ─── 5. KIỂM TRA LẠI BALANCE CỦA CẢ 2 VÍ ───
    console.log('5. Đang truy xuất lại số dư mới từ Server...');
    const updatedSender = await makeRequest('GET', `/wallet/${sender.publicKey}`);
    const updatedRecipient = await makeRequest('GET', `/wallet/${recipient.publicKey}`);

    console.log(`   -> Số dư của người gửi (${sender.name}):`);
    console.log(`      Trước: ${sender.balance} BTC | Sau: ${updatedSender.wallet.balance} BTC (Giảm ${sendAmount} BTC)`);
    console.log(`   -> Số dư của người nhận (${recipient.name}):`);
    console.log(`      Trước: ${recipient.balance} BTC | Sau: ${updatedRecipient.wallet.balance} BTC (Tăng ${sendAmount} BTC)\n`);

    // ─── 6. TRUY XUẤT BLOCKCHAIN EXPLORER ĐỂ XEM BLOCK MỚI ───
    console.log('6. Đang kiểm tra danh sách block trên Blockchain...');
    const chainRes = await makeRequest('GET', '/chain');
    const latestBlock = chainRes.chain[chainRes.chain.length - 1];

    console.log(`   -> Tổng số blocks: ${chainRes.chain.length}`);
    console.log('   -> Thông tin chi tiết của Block mới nhất:');
    console.log(`      Height        : ${chainRes.chain.length - 1}`);
    console.log(`      Previous Hash : ${latestBlock.previousHash}`);
    console.log(`      Hash          : ${latestBlock.hash}`);
    console.log(`      Timestamp     : ${new Date(Number(latestBlock.timestamp)).toLocaleString()}`);
    console.log('      Transactions  :');
    latestBlock.transactions.forEach((tx, idx) => {
      console.log(`        Giao dịch #${idx + 1}:`);
      console.log(`          Sender : ${tx.senderPublicKey}`);
      console.log(`          Recip  : ${tx.recipient}`);
      console.log(`          Amount : ${tx.amount} BTC`);
    });

    console.log('\n================================================================');
    console.log('         HOÀN THÀNH LUỒNG KIỂM TRA GIAO DỊCH THÀNH CÔNG!        ');
    console.log('================================================================');

  } catch (error) {
    console.error('\n❌ KIỂM TRA THẤT BẠI:');
    console.error(error.message);
  }
}

run();
