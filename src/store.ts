import fs from "node:fs";
import path from "node:path";
import { loadConfig, readJson, writeJson } from "./config.js";
import {
  buildAuthorizeUrl,
  INTUIT_DOCS,
  INTUIT_SCOPES,
  officialRequestMap,
} from "./intuit/official.js";
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

  startOAuth(): {
    authorizeUrl?: string;
    session?: OAuthSession;
    message: string;
    docs?: string;
    scope?: string;
  } {
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

    const state = `qbo-mcp-${Date.now().toString(36)}`;
    const authorizeUrl = buildAuthorizeUrl({
      clientId: this.config.intuitClientId,
      redirectUri: this.config.intuitRedirectUri,
      state,
    });
    return {
      authorizeUrl,
      message:
        "Open the Intuit OAuth 2.0 authorize URL (browser required). Exchange the callback code once at the token endpoint. Door 1 prove path uses --fixture instead.",
      docs: INTUIT_DOCS.oauth20,
      scope: INTUIT_SCOPES.accounting,
    };
  }

  requestMap() {
    const session = this.session();
    return officialRequestMap({
      env: this.config.intuitEnv,
      clientId: this.config.intuitClientId || "replace_with_your_intuit_client_id",
      redirectUri: this.config.intuitRedirectUri,
      realmId: session?.realmId ?? "acme-bookkeeping-fixture",
    });
  }

  completeFixtureOAuth(): OAuthSession {
    const recorded = readJson<OAuthSession>(path.join(this.config.fixtureDir, "oauth-session.json"));
    const session: OAuthSession = {
      ...recorded,
      mode: "fixture",
      token_type: "bearer",
      expires_in: recorded.expires_in ?? 3600,
      access_token: recorded.accessToken,
      refresh_token: recorded.refreshToken,
      connectedAt: new Date().toISOString(),
    };
    writeJson(this.config.tokensPath, session);
    return session;
  }

  readCompany(): Company {
    this.requireSession();
    return readJson<Company>(path.join(this.config.fixtureDir, "company.json"));
  }

  readCompanyOfficial() {
    this.requireSession();
    return {
      company: this.readCompany(),
      intuit: readJson<unknown>(path.join(this.config.fixtureDir, "companyinfo.json")),
      request: this.requestMap().accounting,
    };
  }

  listEmployees(): Employee[] {
    this.requireSession();
    return this.readEmployeesFile();
  }

  listEmployeesOfficial() {
    const employees = this.listEmployees();
    return {
      company: this.readCompany().name,
      employees,
      intuit: {
        QueryResponse: {
          Employee: employees.map((item) => ({
            Id: item.id,
            DisplayName: item.displayName,
            GivenName: item.givenName,
            FamilyName: item.familyName,
            Active: item.active,
          })),
          maxResults: employees.length,
          startPosition: 1,
        },
      },
      compensations: this.readCompensations(),
      request: this.requestMap().accounting,
    };
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
    writeJson(path.join(this.config.fixtureDir, "employees.json"), { employees: next });
    this.writeCompensationRate(employeeId, annualSalaryExample);
    return {
      applied: true,
      confirmScreen: true,
      message:
        "Example annual salary updated on the fixture compensation overlay. Accounting Employee has no annual salary field. Payroll was not submitted.",
      current: proposed,
      proposed,
      intuit: {
        employeeSparseUpdate: "not a payroll submit",
        compensationResource: "payrollEmployeeCompensations",
      },
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
        "Door 1 dry-run. Confirm screen defaults ON. Official payslips appear only after a human runs payroll in QuickBooks. This connector never auto-submits payroll.",
      intuit: {
        payslipResource: "payrollPayslips",
        createPayrollRun: null,
        workforceSandbox: false,
        docs: INTUIT_DOCS.payslips,
      },
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
      intuit: {
        compensationsQuery: "payrollEmployeeCompensations",
        payslipsQuery: "payrollPayslips",
        createPayrollRun: null,
      },
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

  private readCompensations(): unknown {
    return readJson<unknown>(path.join(this.config.fixtureDir, "payroll-compensations.json"));
  }

  private writeCompensationRate(employeeId: string, annualSalaryExample: number): void {
    const filePath = path.join(this.config.fixtureDir, "payroll-compensations.json");
    const raw = readJson<{
      data?: {
        payrollEmployeeCompensations?: {
          edges?: Array<{ node?: { employeeId?: string; rateExample?: { value?: string } } }>;
        };
      };
      note?: string;
    }>(filePath);
    const edges = raw.data?.payrollEmployeeCompensations?.edges ?? [];
    for (const edge of edges) {
      if (edge.node?.employeeId === employeeId && edge.node.rateExample) {
        edge.node.rateExample.value = String(annualSalaryExample);
      }
    }
    writeJson(filePath, raw);
  }

  private isPlaceholderApp(): boolean {
    const id = this.config.intuitClientId;
    return !id || /replace|your_|example|placeholder|changeme/i.test(id);
  }
}

export function formatToolResult(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
