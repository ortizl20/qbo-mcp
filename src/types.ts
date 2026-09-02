export type BackendMode = "fixture" | "live";

export interface Company {
  id: string;
  name: string;
  legalName: string;
  country: string;
  note: string;
  fixture: boolean;
}

export interface Employee {
  id: string;
  displayName: string;
  givenName: string;
  familyName: string;
  active: boolean;
  /** Example annual salary. Round teaching number, not a live payroll figure. */
  annualSalaryExample: number;
}

export interface OAuthSession {
  mode: BackendMode;
  realmId: string;
  accessToken: string;
  refreshToken: string;
  connectedAt: string;
  company: string;
}

export interface PayrollStatus {
  runId: string;
  company: string;
  state: "dry_run_preview" | "not_submitted";
  submitted: false;
  dryRun: true;
  confirmScreen: true;
  note: string;
}

export interface PayrollLine {
  employeeId: string;
  displayName: string;
  annualSalaryExample: number;
  periodGrossExample: number;
}

export interface PayrollPreview {
  company: string;
  fixture: boolean;
  dryRun: true;
  confirmScreen: true;
  submitted: false;
  periodLabel: string;
  lines: PayrollLine[];
  totals: {
    employeeCount: number;
    periodGrossExample: number;
    annualSalaryExample: number;
  };
  note: string;
  markdownPath?: string;
  htmlPath?: string;
}

export interface AppConfig {
  intuitClientId: string;
  intuitClientSecret: string;
  intuitRedirectUri: string;
  intuitEnv: "sandbox" | "production";
  dryRun: boolean;
  mode: BackendMode;
  fixtureDir: string;
  tokensPath: string;
  repoRoot: string;
}
