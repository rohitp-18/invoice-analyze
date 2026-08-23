import { redirect } from "next/navigation";

export default function InvoiceDetailsRedirectPage() {
  redirect("/dashboard/invoices/my");
}
