import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import PushPermissionPrompt from "@/components/PushPermissionPrompt"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistrar />
      <PushPermissionPrompt />
      {children}
    </>
  )
}
