# qbo-mcp

MCP connector so agents can operate QuickBooks Online for a bookkeeping tenant.

Bring your own Intuit app (BYOK). Door 1 ships a recorded **Acme Bookkeeping** fixture so you can prove the map without a live company. Payroll is dry-run only: confirm-screen defaults on, and this server never submits pay.

Clone: `YOUR_GITHUB_ORG/qbo-mcp`

## Install

Node 20+.

```bash
git clone https://github.com/YOUR_GITHUB_ORG/qbo-mcp.git
cd qbo-mcp
cp .env.example .env
npm install
npm run build
```

`.env.example` is placeholders only. Leave them as-is to stay on the fixture path.

## Fixture path (no live tenant)

```bash
npm run oauth:fixture
node dist/index.js company
node dist/index.js employees
node dist/index.js salary emp-001 84000 --confirm
node dist/index.js payroll-status
node dist/index.js payroll-preview
```

Fixture employees are **Jordan Lee** and **Sam Patel**. Example annual salaries are round teaching numbers (60000, 72000) labeled EXAMPLE.

Screenshot-ready dry-run output:

- `fixtures/acme/payroll-preview.md`
- `fixtures/acme/payroll-preview.html`

## MCP install (stdio)

Claude Desktop / Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "qbo": {
      "command": "node",
      "args": ["/absolute/path/to/qbo-mcp/dist/index.js"],
      "env": {
        "INTUIT_CLIENT_ID": "replace_with_your_intuit_client_id",
        "INTUIT_CLIENT_SECRET": "replace_with_your_intuit_client_secret",
        "INTUIT_REDIRECT_URI": "http://localhost:8000/callback",
        "INTUIT_ENV": "sandbox",
        "QBO_DRY_RUN": "1"
      }
    }
  }
}
```

Placeholder client id selects the recorded fixture automatically. Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Tools

| Tool | What it does |
| --- | --- |
| `qbo_oauth` | Fixture sandbox completes immediately. Live mode returns your Intuit authorize URL. |
| `qbo_read_company` | Read company profile. |
| `qbo_list_employees` | List employees. |
| `qbo_update_employee_salary` | Set one employee's example annual salary. `confirm` defaults false. |
| `qbo_payroll_status` | Payroll run status (always not submitted). |
| `qbo_payroll_preview` | Dry-run totals and writes the preview files. |

There is no submit-payroll tool.

## Official Intuit contracts

Door 1 is mapped to published Intuit docs (not only MCP SDK docs). See `docs/intuit-map.md`.

```bash
node dist/index.js intuit-map
```

| Area | Official source | Door 1 |
| --- | --- | --- |
| OAuth 2.0 | [Set up OAuth 2.0](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0) + [discovery](https://developer.api.intuit.com/.well-known/openid_sandbox_configuration) | Authorize URL / token exchange builders. Fixture OAuth does not call Intuit. |
| Company + employees | Accounting REST `CompanyInfo` and `SELECT * FROM Employee` | Fixture returns official-shaped JSON. |
| Pay rates | Workforce GraphQL `payrollEmployeeCompensations` (Silver+, **not in sandbox**) | Recorded Acme fixture. |
| Payroll run | Payslips after a human runs payroll. No public create-run mutation. | Preview totals only. `QBO_DRY_RUN=1`. |

No App Store submission. No production keys in this repo.

## BYOK live app (optional)

Fill `.env` with your own Intuit app, keep `INTUIT_ENV=sandbox` and `QBO_DRY_RUN=1`, then call `qbo_oauth` with `fixture=false` to get the official authorize URL (`response_type=code`, scope `com.intuit.quickbooks.accounting`). Door 1 is proven on the fixture; live pay is out of scope.

## Prove

```bash
bash scripts/prove-door1.sh
bash scripts/prove-firewall.sh
```

`prove-door1.sh` installs, builds, walks the fixture map over MCP, and runs the firewall grep. It exits 0 on success.

## Out of scope

Live pay submit, social posts, Intuit App Store listing, and any household bank or bookkeeping login.
