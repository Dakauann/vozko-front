"use client";

import AdminFinancialDashboard from "@/components/dashboard/admin-financial-dashboard";

/**
 * Platform admin overview (financial / ops).
 * Root /dashboard always shows the standard workspace user dashboard,
 * including for system admins.
 */
export default function AdminOverviewPage() {
  return <AdminFinancialDashboard />;
}
