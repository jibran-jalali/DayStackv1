export type AdminAccountStatus = "active" | "disabled";

export interface AdminAccount {
  createdAt: string;
  email: string;
  estimatedOwnedRecords: number | null;
  id: string;
  lastSignInAt: string | null;
  name: string;
  status: AdminAccountStatus;
}

export interface AdminDashboardSnapshot {
  accounts: AdminAccount[];
  activeAccounts: number;
  disabledAccounts: number;
  totalAccounts: number;
}
