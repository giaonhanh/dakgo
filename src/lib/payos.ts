import { PayOS } from "@payos/node"

// Kênh Thu — nhận tiền từ khách đặt hàng / nạp ví
export const payosCollect = new PayOS({
  clientId:    process.env.PAYOS_COLLECT_CLIENT_ID!,
  apiKey:      process.env.PAYOS_COLLECT_API_KEY!,
  checksumKey: process.env.PAYOS_COLLECT_CHECKSUM_KEY!,
})

// Kênh Chi — chuyển tiền ra ngân hàng khi tài xế/khách rút tiền
export const payosPayout = new PayOS({
  clientId:    process.env.PAYOS_PAYOUT_CLIENT_ID!,
  apiKey:      process.env.PAYOS_PAYOUT_API_KEY!,
  checksumKey: process.env.PAYOS_PAYOUT_CHECKSUM_KEY!,
})
