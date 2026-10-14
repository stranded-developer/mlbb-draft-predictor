import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";

export const metadata: Metadata = { title: "Backoffice · MLBB Draft Predictor" };

export default function AdminPage() {
  return <AdminApp />;
}
