import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./config.js";
import {
  INTUIT_API,
  INTUIT_OAUTH,
  INTUIT_SCOPES,
  buildAuthorizeUrl,
  officialRequestMap,
} from "./intuit/official.js";

function textOf(result: unknown): string {
  const record = result as { content?: Array<{ type?: string; text?: string }>; toolResult?: unknown };
  if (Array.isArray(record.content)) {
    return record.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n");
  }
  if (record.toolResult !== undefined) {
    return typeof record.toolResult === "string" ? record.toolResult : JSON.stringify(record.toolResult);
  }
  return JSON.stringify(result);
}

function mustInclude(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: expected to find ${JSON.stringify(needle)}\n${haystack}`);
  }
}

function copyFixture(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}

async function main(): Promise<void> {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "qbo-mcp-acme-"));
  copyFixture(path.join(REPO_ROOT, "fixtures", "acme"), work);
  const tokensPath = path.join(work, "session.json");
  const serverPath = path.join(REPO_ROOT, "dist", "index.js");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      INTUIT_CLIENT_ID: "replace_with_your_intuit_client_id",
      INTUIT_CLIENT_SECRET: "replace_with_your_intuit_client_secret",
      INTUIT_REDIRECT_URI: "http://localhost:8000/callback",
      INTUIT_ENV: "sandbox",
      QBO_DRY_RUN: "1",
      QBO_MODE: "fixture",
      QBO_FIXTURE_DIR: work,
      QBO_TOKENS_PATH: tokensPath,
    },
  });

  const client = new Client({ name: "prove-door1", version: "0.1.0" });
  await client.connect(transport);

  try {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    const required = [
      "qbo_oauth",
      "qbo_read_company",
      "qbo_list_employees",
      "qbo_update_employee_salary",
      "qbo_payroll_status",
      "qbo_payroll_preview",
    ];
    for (const name of required) {
      if (!names.includes(name)) {
        throw new Error(`missing tool ${name}; have ${names.join(", ")}`);
      }
    }

    const oauth = textOf(await client.callTool({ name: "qbo_oauth", arguments: { fixture: true } }));
    mustInclude(oauth, "Acme Bookkeeping", "oauth");
    mustInclude(oauth, "fixture", "oauth");

    const company = textOf(await client.callTool({ name: "qbo_read_company", arguments: {} }));
    mustInclude(company, "Acme Bookkeeping", "company");
    mustInclude(company, "CompanyInfo", "company official shape");

    const employees = textOf(await client.callTool({ name: "qbo_list_employees", arguments: {} }));
    mustInclude(employees, "Jordan Lee", "employees");
    mustInclude(employees, "Sam Patel", "employees");
    mustInclude(employees, "QueryResponse", "employees official shape");
    mustInclude(employees, "payrollEmployeeCompensations", "employees pay rates");

    const confirmScreen = textOf(
      await client.callTool({
        name: "qbo_update_employee_salary",
        arguments: { employee_id: "emp-001", annual_salary: 84000, confirm: false },
      }),
    );
    mustInclude(confirmScreen, "confirmScreen", "salary confirm");
    mustInclude(confirmScreen, '"applied": false', "salary confirm");

    const applied = textOf(
      await client.callTool({
        name: "qbo_update_employee_salary",
        arguments: { employee_id: "emp-001", annual_salary: 84000, confirm: true },
      }),
    );
    mustInclude(applied, '"applied": true', "salary apply");
    mustInclude(applied, "84000", "salary apply");

    const status = textOf(await client.callTool({ name: "qbo_payroll_status", arguments: {} }));
    mustInclude(status, '"submitted": false', "payroll status");
    mustInclude(status, '"dryRun": true', "payroll status");
    mustInclude(status, '"createPayrollRun": null', "payroll status no submit");
    mustInclude(status, "payrollPayslips", "payroll status official resource");

    const preview = textOf(await client.callTool({ name: "qbo_payroll_preview", arguments: { write: true } }));
    mustInclude(preview, "Jordan Lee", "preview");
    mustInclude(preview, "Sam Patel", "preview");
    mustInclude(preview, "84000", "preview updated salary");
    mustInclude(preview, '"submitted": false', "preview");
    mustInclude(preview, "payrollEmployeeCompensations", "preview pay rates");
    mustInclude(preview, '"createPayrollRun": null', "preview no submit");

    const previewMd = fs.readFileSync(path.join(work, "payroll-preview.md"), "utf8");
    mustInclude(previewMd, "EXAMPLE", "written markdown");
    mustInclude(previewMd, "not** submitted", "written markdown dry-run");
    mustInclude(previewMd, "Jordan Lee", "written markdown");
    mustInclude(previewMd, "Sam Patel", "written markdown");

    const committed = fs.readFileSync(path.join(REPO_ROOT, "fixtures", "acme", "payroll-preview.md"), "utf8");
    mustInclude(committed, "Acme Bookkeeping", "committed preview");
    mustInclude(committed, "Jordan Lee", "committed preview");
    mustInclude(committed, "Sam Patel", "committed preview");
    mustInclude(committed, "EXAMPLE", "committed preview");

    const authorizeUrl = buildAuthorizeUrl({
      clientId: "replace_with_your_intuit_client_id",
      redirectUri: "http://localhost:8000/callback",
      state: "prove-state",
    });
    mustInclude(authorizeUrl, INTUIT_OAUTH.authorizationEndpoint, "authorize host");
    mustInclude(authorizeUrl, "response_type=code", "authorize response_type");
    mustInclude(authorizeUrl, encodeURIComponent(INTUIT_SCOPES.accounting), "authorize scope");

    const map = officialRequestMap({
      env: "sandbox",
      clientId: "replace_with_your_intuit_client_id",
      redirectUri: "http://localhost:8000/callback",
      realmId: "acme-bookkeeping-fixture",
    });
    const mapText = JSON.stringify(map);
    mustInclude(mapText, INTUIT_OAUTH.tokenEndpoint, "token endpoint");
    mustInclude(mapText, `${INTUIT_API.accountingSandbox}/v3/company/`, "sandbox accounting host");
    mustInclude(mapText, "SELECT * FROM Employee", "employee query");
    mustInclude(mapText, INTUIT_API.workforceGraphql, "workforce graphql");
    mustInclude(mapText, "payrollEmployeeCompensations", "compensation query");
    if (map.payroll && typeof map.payroll === "object" && map.payroll !== null) {
      const payroll = map.payroll as { submitPayrollRun: unknown; sandboxWorkforce: unknown };
      if (payroll.submitPayrollRun !== null) {
        throw new Error("submitPayrollRun must be null");
      }
      if (payroll.sandboxWorkforce !== false) {
        throw new Error("sandboxWorkforce must be false per official Workforce docs");
      }
    }

    const committedDiscovery = fs.readFileSync(path.join(REPO_ROOT, "fixtures", "acme", "discovery.json"), "utf8");
    mustInclude(committedDiscovery, INTUIT_OAUTH.authorizationEndpoint, "recorded discovery");
    mustInclude(committedDiscovery, INTUIT_OAUTH.tokenEndpoint, "recorded discovery token");

    console.log("prove-mcp: fixture OAuth, company, employees, salary, payroll preview OK");
    console.log("prove-mcp: official Intuit OAuth + Accounting + Payroll map OK");
    console.log(`prove-mcp: captured preview at ${path.join(work, "payroll-preview.md")}`);
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
