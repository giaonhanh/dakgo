import MaintenanceGate from "@/components/MaintenanceGate"
import PushPermissionPrompt from "@/components/PushPermissionPrompt"

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <MaintenanceGate>
      {children}
      <PushPermissionPrompt />
    </MaintenanceGate>
  )
}
