import fs from "node:fs";
import path from "node:path";
import { loadConfig, readJson, writeJson } from "./config.js";
import { renderPayrollHtml, renderPayrollMarkdown } from "./preview.js";
import type {
  AppConfig,
  Company,
  Employee,
  OAuthSession,
  PayrollPreview,
  PayrollStatus,
} from "./types.js";

const PERIOD_LABEL = "example monthly period";
const MONTHS_PER_YEAR = 12;

export class QboStore {
  constructor(private readonly config: AppConfig) {}

  static fromEnv(overrides: Partial<AppConfig> = {}): QboStore {
    return new QboStore(loadConfig(overrides));
  }

  get mode() {
    return this.config.mode;
  }

  get dryRun() {
    return this.config.dryRun;
  }

  session(): OAuthSession | null {
    if (!fs.existsSync(this.config.tokensPath)) return null;
    return readJson<OAuthSession>(this.config.tokensPath);
  }

  requireSession(): OAuthSession {
    const session = this.session();
    if (!session) {
      throw new Error(
        "No OAuth session. Run `qbo-mcp oauth --fixture` (recorded Acme sandbox) or complete live Intuit OAuth with your own app.",
      );
    }
    return session;
  }

  startOAuth(): { authorizeUrl?: string; session?: OAuthSession; message: string } {
    if (this.config.mode === "fixture" || this.isPlaceholderApp()) {
      const session = this.completeFixtureOAuth();
      return {
        session,
        message: "Fixture OAuth complete. Recorded Acme Bookkeeping sandbox is connected. No live Intuit account was used.",
      };
    }

    if (this.isPlaceholderApp()) {
      return {
        message: "INTUIT_CLIENT_ID is still a placeholder. Use fixture mode or put your own Intuit app id in .env.",
      };
    }

    const state = "qbo-mcp-door1";
    const url = new URL("https://appcenter.intuit.com/connect/oauth2");
    url.searchParams.set("client_id", this.config.intuitClientId);
    url.searchParams.set("redirect_uri", this.config.intuitRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
    url.searchParams.set("state", state);
    return {
      authorizeUrl: url.toString(),
      message:
        "Open the authorize URL, then exchange the callback code with your own Intuit app. Door 1 prove path uses --fixture instead.",
    };
  }

  completeFixtureOAuth(): OAuthSession {
    const recorded = readJson<OAuthSession>(path.join(this.config.fixtureDir, "oauth-session.json"));
    const session: OAuthSession = {
      ...recorded,
      mode: "fixture",
      connectedAt: new Date().toISOString(),
    };
    writeJson(this.config.tokensPath, session);
    return session;
  }

  readCompany(): Company {
    this.requireSession();
    if (this.config.mode === "live") {
      throw new Error(
        "Live company read is not part of the Door 1 prove path. Use QBO_MODE=fixture or placeholder credentials.",
      );
    }
    return readJson<Company>(path.join(this.config.fixtureDir, "company.json"));
  }

  listEmployees(): Employee[] {
    this.requireSession();
    return this.readEmployeesFile();
  }

  updateEmployeeSalary(employeeId: string, annualSalaryExample: number, confirm: boolean) {
    this.requireSession();
    if (!Number.isFinite(annualSalaryExample) || annualSalaryExample <= 0) {
      throw new Error("annual_salary must be a positive example number (use a round teaching figure such as 60000).");
    }
    const employees = this.readEmployeesFile();
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      throw new Error(`Unknown fixture employee id: ${employeeId}`);
    }
    const proposed = { ...employee, annualSalaryExample };
    if (!confirm) {
      return {
        applied: false,
        confirmScreen: true,
        message: "Confirm screen is ON. Re-call with confirm=true to apply this example salary. Payroll is not submitted.",
        current: employee,
        proposed,
      };
    }
    const next = employees.map((item) => (item.id === employeeId ? proposed : item));
    writeJson(path.join(this.config.fixtureDir, "employees.json"), next);
    return {
      applied: true,
      confirmScreen: true,
      message: "Example annual salary updated on the fixture employee. Payroll was not submitted.",
      current: proposed,
      proposed,
    };
  }

  payrollStatus(): PayrollStatus {
    this.requireSession();
    const company = this.readCompany();
    const recorded = readJson<Partial<PayrollStatus>>(path.join(this.config.fixtureDir, "payroll-status.json"));
    return {
      runId: recorded.runId ?? "pay-preview-acme-001",
      company: company.name,
      state: "dry_run_preview",
      submitted: false,
      dryRun: true,
      confirmScreen: true,
      note:
        recorded.note ??
        "Door 1 dry-run. Confirm screen defaults ON. This connector never auto-submits payroll.",
    };
  }

  payrollPreview(writeFiles = true): PayrollPreview {
    this.requireSession();
    if (!this.config.dryRun) {
      throw new Error("QBO_DRY_RUN is off, but Door 1 still refuses to submit payroll. Set QBO_DRY_RUN=1 and preview only.");
    }
    const company = this.readCompany();
    const employees = this.listEmployees().filter((item) => item.active);
    const lines = employees.map((item) => ({
      employeeId: item.id,
      displayName: item.displayName,
      annualSalaryExample: item.annualSalaryExample,
      periodGrossExample: Math.round(item.annualSalaryExample / MONTHS_PER_YEAR),
    }));
    const preview: PayrollPreview = {
      company: company.name,
      fixture: true,
      dryRun: true,
      confirmScreen: true,
      submitted: false,
      periodLabel: PERIOD_LABEL,
      lines,
      totals: {
        employeeCount: lines.length,
        periodGrossExample: lines.reduce((sum, line) => sum + line.periodGrossExample, 0),
        annualSalaryExample: lines.reduce((sum, line) => sum + line.annualSalaryExample, 0),
      },
      note: "EXAMPLE totals for the recorded Acme Bookkeeping fixture. Screenshot this confirm screen. Do not treat as live pay.",
    };

    if (writeFiles) {
      const markdownPath = path.join(this.config.fixtureDir, "payroll-preview.md");
      const htmlPath = path.join(this.config.fixtureDir, "payroll-preview.html");
      fs.writeFileSync(markdownPath, renderPayrollMarkdown(preview), "utf8");
      fs.writeFileSync(htmlPath, renderPayrollHtml(preview), "utf8");
      preview.markdownPath = markdownPath;
      preview.htmlPath = htmlPath;
    }
    return preview;
  }

  private readEmployeesFile(): Employee[] {
    const filePath = path.join(this.config.fixtureDir, "employees.json");
    const raw = readJson<{ employees?: Employee[] } | Employee[]>(filePath);
    return Array.isArray(raw) ? raw : (raw.employees ?? []);
  }

  private isPlaceholderApp(): boolean {
    const id = this.config.intuitClientId;
    return !id || /replace|your_|example|placeholder|changeme/i.test(id);
  }
}

export function formatToolResult(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
