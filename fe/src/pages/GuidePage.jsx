import { useState } from 'react';
import {
  Wallet, ArrowLeftRight, Pickaxe, Search, ChevronDown, ChevronUp,
  CircleCheck, Key, Shield, Zap, Layers, BookOpen, AlertTriangle,
  Hash, Lock, GitBranch, Cpu
} from 'lucide-react';

const STEPS = [
  {
    step: 1,
    icon: <Wallet size={28} color="var(--accent)" />,
    color: 'var(--accent)',
    bg: 'rgba(79,70,229,0.1)',
    border: 'rgba(79,70,229,0.25)',
    title: 'Tạo Ví (Wallet)',
    tab: 'Ví',
    desc: 'Ví là "tài khoản" của bạn trên blockchain. Mỗi ví có một cặp khóa mật mã duy nhất.',
    actions: [
      'Vào tab **Ví** → nhấn **Tạo Ví Mới**',
      'Đặt tên dễ nhớ cho ví (vd: "Ví chính của tôi")',
      'Hệ thống tự động tạo **Private Key** (bí mật) và **Public Key** (địa chỉ ví)',
      'Ví mới sẽ có số dư **0 BTC** — bạn cần nhận BTC từ người khác hoặc đào coin',
    ],
    note: 'Private Key là duy nhất và không thể khôi phục. Đây là demo nên key được lưu trong localStorage của trình duyệt.',
    noteType: 'warning',
  },
  {
    step: 2,
    icon: <ArrowLeftRight size={28} color="var(--accent-green)" />,
    color: 'var(--accent-green)',
    bg: 'rgba(4,120,87,0.1)',
    border: 'rgba(4,120,87,0.25)',
    title: 'Tạo Giao Dịch (Transaction)',
    tab: 'Giao Dịch',
    desc: 'Giao dịch là lệnh chuyển BTC từ ví này sang ví khác. Mỗi giao dịch được ký bằng Private Key.',
    actions: [
      'Vào tab **Giao Dịch** → chọn ví người gửi (phải có số dư)',
      'Nhập địa chỉ người nhận (Public Key của ví đích)',
      'Nhập số lượng BTC muốn chuyển và phí Gas',
      'Nhấn **Gửi Giao Dịch** — giao dịch sẽ vào **Mempool** (hàng chờ)',
      'Giao dịch chưa hoàn thành cho đến khi được Miner đưa vào Block!',
    ],
    note: 'Phí Gas cao hơn = Miner ưu tiên gom vào block trước. Tối thiểu 0.0001 BTC.',
    noteType: 'info',
  },
  {
    step: 3,
    icon: <Pickaxe size={28} color="#a78bfa" />,
    color: '#a78bfa',
    bg: 'rgba(124,58,237,0.1)',
    border: 'rgba(124,58,237,0.25)',
    title: 'Đào Coin (Mining)',
    tab: 'Mining',
    desc: 'Miner thu gom các giao dịch đang chờ trong Mempool, giải bài toán Proof-of-Work và đóng gói thành Block mới.',
    actions: [
      'Vào tab **Mining** → chọn ví nhận phần thưởng',
      'Kiểm tra danh sách giao dịch trong **Mempool**',
      'Nhấn **Bắt đầu khai thác (PoW)** — CPU/GPU tìm Nonce hợp lệ',
      'Hệ thống tính SHA-256 liên tục cho đến khi hash bắt đầu bằng đủ số chữ số 0',
      'Khi tìm được Nonce: Block được gửi lên server → giao dịch hoàn tất!',
      'Miner nhận **2 BTC phần thưởng** + tổng phí Gas của các giao dịch trong block',
    ],
    note: 'Độ khó (difficulty) = 4 có nghĩa là hash phải bắt đầu bằng "0000...". Càng nhiều chữ số 0 = càng khó đào.',
    noteType: 'info',
  },
  {
    step: 4,
    icon: <Search size={28} color="var(--accent-yellow)" />,
    color: 'var(--accent-yellow)',
    bg: 'rgba(180,83,9,0.1)',
    border: 'rgba(180,83,9,0.25)',
    title: 'Xem Blockchain (Explorer)',
    tab: 'Explorer',
    desc: 'Blockchain là chuỗi các block nối tiếp nhau. Mỗi block chứa danh sách giao dịch và hash của block trước.',
    actions: [
      'Vào tab **Explorer** để xem toàn bộ chuỗi block',
      'Nhấn vào từng block để xem chi tiết các giao dịch bên trong',
      'Kiểm tra hash, nonce, timestamp của mỗi block',
      'Xác minh tính toàn vẹn: hash của block N = dữ liệu trong block (N+1)',
    ],
    note: 'Block #0 là Genesis Block — block đầu tiên, được tạo sẵn khi khởi động hệ thống.',
    noteType: 'info',
  },
];

const CONCEPTS = [
  {
    icon: <Hash size={20} color="var(--accent)" />,
    title: 'SHA-256 Hash',
    desc: 'Hàm băm một chiều — không thể đảo ngược. Thay đổi 1 ký tự đầu vào → hash hoàn toàn khác. Đây là nền tảng bảo mật của Bitcoin.',
  },
  {
    icon: <Key size={20} color="var(--accent-green)" />,
    title: 'secp256k1 (Elliptic Curve)',
    desc: 'Thuật toán mật mã đường cong elliptic dùng trong Bitcoin. Private Key → Public Key là một chiều; không thể tính ngược lại.',
  },
  {
    icon: <Shield size={20} color="#a78bfa" />,
    title: 'Schnorr Signature',
    desc: 'Giao thức ký số hiệu quả hơn ECDSA. Cho phép gộp nhiều chữ ký thành một (Key Aggregation), giảm kích thước block.',
  },
  {
    icon: <Cpu size={20} color="var(--accent-yellow)" />,
    title: 'Proof of Work (PoW)',
    desc: 'Cơ chế đồng thuận yêu cầu Miner giải bài toán tính toán nặng (tìm Nonce). Ngăn chặn gian lận vì cần chi phí tính toán thực.',
  },
  {
    icon: <Layers size={20} color="var(--accent-red)" />,
    title: 'Mempool',
    desc: 'Memory Pool — hàng chờ giao dịch chưa được đóng gói. Miner chọn giao dịch từ mempool dựa vào phí Gas để tối đa hóa lợi nhuận.',
  },
  {
    icon: <GitBranch size={20} color="var(--accent)" />,
    title: 'Orphan Block',
    desc: 'Xảy ra khi 2 Miner đào được block cùng lúc. Block đến server sau sẽ bị từ chối vì chain đã được cập nhật bởi block đến trước.',
  },
  {
    icon: <Lock size={20} color="var(--accent-green)" />,
    title: 'Immutability (Bất biến)',
    desc: 'Mỗi block chứa hash của block trước. Sửa một block sẽ làm vô hiệu tất cả block phía sau — đây là cách blockchain bảo vệ lịch sử.',
  },
  {
    icon: <Zap size={20} color="var(--accent-yellow)" />,
    title: 'Gas Fee',
    desc: 'Phí trả cho Miner để ưu tiên xử lý giao dịch. Phí cao hơn = khả năng được đưa vào block tiếp theo cao hơn.',
  },
];

function StepCard({ step, onTabSwitch }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${open ? step.border : 'var(--border)'}`,
        borderLeft: `4px solid ${step.color}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'all 0.25s',
        boxShadow: open ? `0 4px 24px ${step.bg}` : 'none',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '1.2rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '12px',
          background: step.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {step.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
              borderRadius: '20px', background: step.bg, color: step.color,
            }}>
              BƯỚC {step.step}
            </span>
            <span style={{
              fontSize: '0.68rem', color: 'var(--text-muted)',
              background: 'var(--bg-secondary)', padding: '2px 8px',
              borderRadius: '20px',
            }}>
              Tab: {step.tab}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {step.title}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {step.desc}
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Expandable content */}
      {open && (
        <div style={{ padding: '0 1.5rem 1.5rem', animation: 'fadeIn 0.2s ease' }}>
          <div style={{
            width: '100%', height: '1px',
            background: 'var(--border)', marginBottom: '1.2rem',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.2rem' }}>
            {step.actions.map((action, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: step.bg, border: `1px solid ${step.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.68rem', fontWeight: 800, color: step.color,
                  flexShrink: 0, marginTop: '1px',
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{
                    __html: action.replace(/\*\*(.*?)\*\*/g, `<strong style="color:var(--text-primary)">$1</strong>`)
                  }}
                />
              </div>
            ))}
          </div>

          {/* Note */}
          <div style={{
            background: step.noteType === 'warning' ? 'rgba(180,83,9,0.08)' : 'rgba(79,70,229,0.08)',
            border: `1px solid ${step.noteType === 'warning' ? 'rgba(180,83,9,0.25)' : 'rgba(79,70,229,0.2)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }}
              color={step.noteType === 'warning' ? 'var(--accent-yellow)' : 'var(--accent)'} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {step.note}
            </span>
          </div>

          <button
            onClick={() => onTabSwitch(step.tab)}
            style={{
              marginTop: '1rem',
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${step.border}`,
              background: step.bg,
              color: step.color,
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            <CircleCheck size={15} /> Đi đến tab {step.tab} →
          </button>
        </div>
      )}
    </div>
  );
}

export default function GuidePage({ onTabSwitch }) {
  const TAB_MAP = {
    'Ví': 'wallet',
    'Giao Dịch': 'transaction',
    'Mining': 'mining',
    'Explorer': 'explorer',
  };

  const handleTabSwitch = (tabLabel) => {
    if (onTabSwitch) onTabSwitch(TAB_MAP[tabLabel]);
  };

  return (
    <div className="animate-fade">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))',
        border: '1px solid rgba(79,70,229,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        marginBottom: '2rem',
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '16px',
          background: 'linear-gradient(135deg, #4338ca, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
        }}>
          <BookOpen size={32} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Chào mừng đến với CryptoChain!
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '600px' }}>
            Đây là blockchain demo mô phỏng cơ chế hoạt động thực tế của Bitcoin — bao gồm mật mã học secp256k1, chữ ký Schnorr, Proof-of-Work và cấu trúc chuỗi khối bất biến.
          </div>
        </div>
        <div style={{
          background: 'rgba(79,70,229,0.1)',
          border: '1px solid rgba(79,70,229,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 20px',
          textAlign: 'center',
          minWidth: '120px',
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent)' }}>4</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>bước để bắt đầu</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', alignItems: 'start' }}>

        {/* Left: Steps */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '1.2rem',
          }}>
            <div style={{
              width: 4, height: 20, background: 'var(--gradient)',
              borderRadius: '2px',
            }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Hướng dẫn từng bước
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              — Nhấn để mở rộng
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {STEPS.map(step => (
              <StepCard key={step.step} step={step} onTabSwitch={handleTabSwitch} />
            ))}
          </div>

          {/* Flow summary */}
          <div style={{
            marginTop: '1.5rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.2rem 1.5rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Quy trình xử lý giao dịch
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              {[
                { label: 'Tạo ví', color: 'var(--accent)', bg: 'rgba(79,70,229,0.1)' },
                { label: '→', color: 'var(--text-muted)', bg: 'transparent', noBorder: true },
                { label: 'Gửi giao dịch', color: 'var(--accent-green)', bg: 'rgba(4,120,87,0.1)' },
                { label: '→', color: 'var(--text-muted)', bg: 'transparent', noBorder: true },
                { label: 'Vào Mempool', color: 'var(--accent-yellow)', bg: 'rgba(180,83,9,0.1)' },
                { label: '→', color: 'var(--text-muted)', bg: 'transparent', noBorder: true },
                { label: 'Miner đào', color: '#a78bfa', bg: 'rgba(124,58,237,0.1)' },
                { label: '→', color: 'var(--text-muted)', bg: 'transparent', noBorder: true },
                { label: 'Block được tạo', color: 'var(--accent-green)', bg: 'rgba(4,120,87,0.1)' },
                { label: '→', color: 'var(--text-muted)', bg: 'transparent', noBorder: true },
                { label: 'Số dư cập nhật ✓', color: 'var(--accent)', bg: 'rgba(79,70,229,0.1)' },
              ].map((item, i) => (
                <span key={i} style={{
                  padding: item.noBorder ? '0' : '3px 10px',
                  borderRadius: '20px',
                  background: item.bg,
                  color: item.color,
                  fontWeight: item.noBorder ? 400 : 600,
                  border: item.noBorder ? 'none' : `1px solid ${item.bg.replace('0.1', '0.3')}`,
                }}>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Concepts */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '1.2rem',
          }}>
            <div style={{
              width: 4, height: 20, background: 'var(--gradient)',
              borderRadius: '2px',
            }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Khái niệm kỹ thuật
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {CONCEPTS.map((c, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '3px' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {c.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
