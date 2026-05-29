import { useState } from 'react';

export function useCopy() {
  const [copied, setCopied] = useState(null);

  const copy = (text, key) => {
    // 1. Kiểm tra nếu trình duyệt hỗ trợ Clipboard API và đang ở môi trường an toàn (HTTPS/Localhost)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(key);
          setTimeout(() => setCopied(null), 2000);
        })
        .catch((err) => {
          console.error("Lỗi khi copy bằng Clipboard API:", err);
        });
    } else {
      // 2. Phương pháp dự phòng (Fallback) dành cho môi trường HTTP (IP VPS)
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Giấu ô text ẩn để không ảnh hưởng giao diện
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(key);
          setTimeout(() => setCopied(null), 2000);
        } else {
          console.error("Không thể copy bằng phương pháp fallback");
        }
      } catch (err) {
        console.error("Lỗi hệ thống khi thực hiện lệnh copy fallback:", err);
      }

      // Xóa thẻ ẩn sau khi copy xong
      document.body.removeChild(textArea);
    }
  };

  return { copy, copied };
}