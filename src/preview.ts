import type { PayrollPreview } from "./types.js";

function money(n: number): string {
  return n.toLocaleString("en-US");
}

export function renderPayrollMarkdown(preview: PayrollPreview): string {
  const rows = preview.lines
    .map(
      (line) =>
        `| ${line.displayName} | ${line.employeeId} | ${money(line.annualSalaryExample)} | ${money(line.periodGrossExample)} |`,
    )
    .join("\n");

  return `# Dry-run payroll preview (EXAMPLE)

**Confirm screen: ON.** Payroll was **not** submitted.

| Field | Value |
| --- | --- |
| Company | ${preview.company} |
| Tenant | ${preview.fixture ? "recorded fixture (Acme Bookkeeping)" : "live company"} |
| Period | ${preview.periodLabel} |
| Dry-run | ${preview.dryRun ? "yes (default)" : "no"} |
| Submitted | ${preview.submitted ? "yes" : "no"} |

## Example lines

All dollar figures are labeled **EXAMPLE**. They are round teaching numbers, not live pay.

| Employee | Id | Example annual | Example period gross |
| --- | --- | ---: | ---: |
${rows}
| **Totals** | ${preview.totals.employeeCount} people | **${money(preview.totals.annualSalaryExample)}** | **${money(preview.totals.periodGrossExample)}** |

## Notes

${preview.note}

Door 1 never auto-submits payroll. Preview totals only.
`;
}

export function renderPayrollHtml(preview: PayrollPreview): string {
  const rows = preview.lines
    .map(
      (line) => `        <tr>
          <td>${escapeHtml(line.displayName)}</td>
          <td><code>${escapeHtml(line.employeeId)}</code></td>
          <td class="num">${money(line.annualSalaryExample)}</td>
          <td class="num">${money(line.periodGrossExample)}</td>
        </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>EXAMPLE dry-run payroll — ${escapeHtml(preview.company)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: Georgia, "Times New Roman", serif; margin: 40px auto; max-width: 760px; color: #1a1a1a; }
      .banner { background: #fff3bf; border: 2px solid #e6a817; padding: 14px 18px; font-weight: 700; }
      h1 { font-size: 1.6rem; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
      th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .meta { color: #444; }
      footer { margin-top: 28px; font-size: 0.9rem; color: #555; }
    </style>
  </head>
  <body>
    <div class="banner">EXAMPLE DRY-RUN — PAYROLL NOT SUBMITTED — CONFIRM SCREEN ON</div>
    <h1>Payroll preview for ${escapeHtml(preview.company)}</h1>
    <p class="meta">
      ${preview.fixture ? "Recorded fixture tenant. Not a live company." : "Live company (still dry-run)."}
      Period: ${escapeHtml(preview.periodLabel)}.
    </p>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Id</th>
          <th class="num">Example annual</th>
          <th class="num">Example period gross</th>
        </tr>
      </thead>
      <tbody>
${rows}
        <tr>
          <th>Totals (${preview.totals.employeeCount})</th>
          <th></th>
          <th class="num">${money(preview.totals.annualSalaryExample)}</th>
          <th class="num">${money(preview.totals.periodGrossExample)}</th>
        </tr>
      </tbody>
    </table>
    <p>${escapeHtml(preview.note)}</p>
    <footer>Door 1 MCP connector. Bring-your-own Intuit app. Preview totals only.</footer>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
