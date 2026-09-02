#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatToolResult, QboStore } from "./store.js";

function createServer(): McpServer {
  const store = QboStore.fromEnv();
  const server = new McpServer({
    name: "qbo-mcp",
    version: "0.1.0",
  });

  server.tool(
    "qbo_oauth",
    "Connect OAuth. With placeholder Intuit app env this completes the recorded Acme fixture sandbox. Live mode returns an authorize URL for your own Intuit app.",
    {
      fixture: z
        .boolean()
        .optional()
        .default(true)
        .describe("Use the recorded fixture sandbox. Default true for Door 1."),
    },
    async ({ fixture }) => {
      if (fixture === false && store.mode === "fixture") {
        return text("Fixture mode is on (placeholder env). Completing recorded Acme OAuth anyway.");
      }
      return text(store.startOAuth());
    },
  );

  server.tool(
    "qbo_read_company",
    "Read the connected QuickBooks Online company profile.",
    {},
    async () => text(store.readCompany()),
  );

  server.tool(
    "qbo_list_employees",
    "List employees for the connected company (Acme Bookkeeping fixture names on the prove path).",
    {},
    async () => text({ company: store.readCompany().name, employees: store.listEmployees() }),
  );

  server.tool(
    "qbo_update_employee_salary",
    "Update one employee's example annual salary. Confirm-screen defaults ON; pass confirm=true to apply. Never submits payroll.",
    {
      employee_id: z.string().describe("Fixture employee id, e.g. emp-001"),
      annual_salary: z.number().positive().describe("Example annual salary. Use a round teaching number such as 60000."),
      confirm: z.boolean().optional().default(false).describe("Must be true to apply. Default false (confirm screen)."),
    },
    async ({ employee_id, annual_salary, confirm }) =>
      text(store.updateEmployeeSalary(employee_id, annual_salary, confirm ?? false)),
  );

  server.tool(
    "qbo_payroll_status",
    "Fetch payroll run status. Door 1 is always dry-run / not submitted.",
    {},
    async () => text(store.payrollStatus()),
  );

  server.tool(
    "qbo_payroll_preview",
    "Fetch dry-run payroll preview totals and write screenshot-ready markdown/html. Confirm-screen defaults ON. Never submits payroll.",
    {
      write: z.boolean().optional().default(true).describe("Write payroll-preview.md and .html into the fixture directory."),
    },
    async ({ write }) => text(store.payrollPreview(write ?? true)),
  );

  return server;
}

function text(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : formatToolResult(value) }],
  };
}

async function runMcp(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("qbo-mcp listening on stdio (Door 1, dry-run default on)");
}

async function runCli(argv: string[]): Promise<void> {
  const store = QboStore.fromEnv();
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "oauth": {
      if (rest.includes("--fixture") || store.mode === "fixture") {
        const session = store.completeFixtureOAuth();
        console.log(formatToolResult({ ok: true, session }));
        break;
      }
      console.log(formatToolResult(store.startOAuth()));
      break;
    }
    case "company":
      console.log(formatToolResult(store.readCompany()));
      break;
    case "employees":
      console.log(formatToolResult({ company: store.readCompany().name, employees: store.listEmployees() }));
      break;
    case "salary": {
      const employeeId = rest[0];
      const amount = Number(rest[1]);
      const confirm = rest.includes("--confirm");
      if (!employeeId || !Number.isFinite(amount)) {
        throw new Error("usage: qbo-mcp salary <employee_id> <annual_salary> [--confirm]");
      }
      console.log(formatToolResult(store.updateEmployeeSalary(employeeId, amount, confirm)));
      break;
    }
    case "payroll-status":
      console.log(formatToolResult(store.payrollStatus()));
      break;
    case "payroll-preview":
      console.log(formatToolResult(store.payrollPreview(true)));
      break;
    default:
      throw new Error(
        "usage: qbo-mcp | qbo-mcp oauth --fixture | company | employees | salary <id> <amount> --confirm | payroll-status | payroll-preview",
      );
  }
}

const argv = process.argv.slice(2);
if (argv.length > 0) {
  runCli(argv).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else {
  runMcp().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
