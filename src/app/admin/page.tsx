import { redirect } from 'next/navigation'

// /admin has no page of its own — AdminLayout sends non-admins to /admin/login
export default function AdminIndex() {
  redirect('/admin/dashboard')
}
