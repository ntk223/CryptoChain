/* eslint-disable no-restricted-globals */

// Import thư viện CryptoJS từ CDN vào trong Worker
importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');

let isMining = false;

// Lắng nghe tin nhắn từ React gửi sang
self.onmessage = function (e) {
  const { action, data } = e.data;

  if (action === 'START') {
    isMining = true;
    const { previousHash, timestamp, blockTransactionsStr, difficulty } = data;
    mine(previousHash, timestamp, blockTransactionsStr, difficulty);
  }

  if (action === 'STOP') {
    isMining = false;
  }
};

// Hàm đào coin chạy ngầm
function mine(previousHash, timestamp, blockTransactionsStr, difficulty) {
  const targetPrefix = '0'.repeat(difficulty);
  const maxFifthChar = "4";
  let currentNonce = 0;
  const batchSize = 5000; // Số lượng hash xử lý mỗi đợt trước khi check lệnh dừng
  const startT = Date.now();
  let lastUiUpdate = Date.now();

  function mineStep() {
    // Nếu React gửi lệnh STOP, dừng vòng lặp ngay lập tức
    if (!isMining) return;

    for (let i = 0; i < batchSize; i++) {
      // Tính toán Hash SHA256
      const hash = self.CryptoJS.SHA256(
        `${previousHash}|${timestamp}|${blockTransactionsStr}|${currentNonce}`
      ).toString();

      // Nếu tìm thấy Nonce hợp lệ
      if (hash.startsWith(targetPrefix) && hash.charAt(4) <= maxFifthChar) {
        // Gửi kết quả thành công về cho React
        self.postMessage({
          status: 'SUCCESS',
          payload: { nonce: currentNonce, hash, timestamp }
        });
        isMining = false;
        return;
      }
      currentNonce++;
    }

    // Cứ sau 500ms thì gửi cập nhật tiến độ (Tốc độ đào, số hash đã check) về cho UI hiển thị
    const now = Date.now();
    if (now - lastUiUpdate > 500) {
      const elapsed = (now - startT) / 1000;
      const hashRate = elapsed > 0 ? Math.floor(currentNonce / elapsed) : 0;

      self.postMessage({
        status: 'PROGRESS',
        payload: { hashesChecked: currentNonce, hashRate }
      });
      lastUiUpdate = now;
    }

    // Chạy tiếp đợt hash tiếp theo (Asynchronous để tránh treo Worker con)
    setTimeout(mineStep, 0);
  }

  // Bắt đầu vòng lặp đào
  mineStep();
}