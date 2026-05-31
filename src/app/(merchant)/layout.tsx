import MaintenanceGate from "@/components/MaintenanceGate"

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <MaintenanceGate>{children}</MaintenanceGate>
}
