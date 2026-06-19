import { createClient } from "@/lib/supabase/client"

export interface AdminContact {
  name: string
  phone: string
  email: string
  contactLink: string  // tel: / zalo / custom
  zaloLink: string
  telLink: string
}

const FALLBACK: AdminContact = {
  name: "Admin DakGo",
  phone: "",
  email: "DakGo.phuocan@gmail.com",
  contactLink: "mailto:DakGo.phuocan@gmail.com",
  zaloLink: "",
  telLink: "",
}

export async function getAdminContact(): Promise<AdminContact> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("role", "admin")
      .maybeSingle()

    const phone = data?.phone ?? ""
    const name  = data?.full_name ?? FALLBACK.name

    const zaloLink = phone
      ? `https://zalo.me/${phone.replace(/^0/, "84")}`
      : ""
    const telLink = phone ? `tel:${phone}` : ""

    // Admin can override contact URL in localStorage (set from settings page)
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("admin_contact_link") ?? ""
      : ""

    const contactLink = stored || telLink || FALLBACK.contactLink

    return { name, phone, email: FALLBACK.email, contactLink, zaloLink, telLink }
  } catch {
    return FALLBACK
  }
}
