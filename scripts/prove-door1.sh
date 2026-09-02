#!/usr/bin/env bash
# Prove Door 1: placeholder env, fixture OAuth, employee map, salary, preview, firewall.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.example ]]; then
  echo "missing .env.example"
  exit 1
fi

for key in INTUIT_CLIENT_ID INTUIT_CLIENT_SECRET INTUIT_REDIRECT_URI INTUIT_ENV QBO_DRY_RUN; do
  if ! grep -q "^${key}=" .env.example; then
    echo "missing ${key} in .env.example"
    exit 1
  fi
done

if ! grep -q '^INTUIT_ENV=sandbox$' .env.example; then
  echo "INTUIT_ENV must default to sandbox in .env.example"
  exit 1
fi

if ! grep -q '^QBO_DRY_RUN=1$' .env.example; then
  echo "QBO_DRY_RUN must default to 1 in .env.example"
  exit 1
fi

if [[ ! -f LICENSE ]]; then
  echo "missing MIT LICENSE"
  exit 1
fi
if ! grep -q 'MIT License' LICENSE; then
  echo "LICENSE is not MIT"
  exit 1
fi

bash "$ROOT/scripts/prove-firewall.sh"

npm install
npm run build

export INTUIT_CLIENT_ID=replace_with_your_intuit_client_id
export INTUIT_CLIENT_SECRET=replace_with_your_intuit_client_secret
export INTUIT_REDIRECT_URI=http://localhost:8000/callback
export INTUIT_ENV=sandbox
export QBO_DRY_RUN=1
export QBO_MODE=fixture

node dist/index.js oauth --fixture | tee /tmp/qbo-mcp-oauth.txt
grep -q 'Acme Bookkeeping' /tmp/qbo-mcp-oauth.txt
grep -q 'fixture' /tmp/qbo-mcp-oauth.txt

node dist/index.js company | tee /tmp/qbo-mcp-company.txt
grep -q 'Acme Bookkeeping' /tmp/qbo-mcp-company.txt

node dist/index.js employees | tee /tmp/qbo-mcp-employees.txt
grep -q 'Jordan Lee' /tmp/qbo-mcp-employees.txt
grep -q 'Sam Patel' /tmp/qbo-mcp-employees.txt

node dist/index.js intuit-map | tee /tmp/qbo-mcp-intuit-map.txt
grep -q 'https://appcenter.intuit.com/connect/oauth2' /tmp/qbo-mcp-intuit-map.txt
grep -q 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer' /tmp/qbo-mcp-intuit-map.txt
grep -q 'com.intuit.quickbooks.accounting' /tmp/qbo-mcp-intuit-map.txt
grep -q 'sandbox-quickbooks.api.intuit.com' /tmp/qbo-mcp-intuit-map.txt
grep -qF 'SELECT * FROM Employee' /tmp/qbo-mcp-intuit-map.txt
grep -q 'payrollEmployeeCompensations' /tmp/qbo-mcp-intuit-map.txt
grep -q 'https://qb.api.intuit.com/graphql' /tmp/qbo-mcp-intuit-map.txt
grep -q '"submitPayrollRun": null' /tmp/qbo-mcp-intuit-map.txt

test -f docs/intuit-map.md
grep -q 'developer.intuit.com' docs/intuit-map.md

node dist/prove-mcp.js

test -f fixtures/acme/payroll-preview.md
test -f fixtures/acme/payroll-preview.html
grep -q 'Acme Bookkeeping' fixtures/acme/payroll-preview.md
grep -q 'Jordan Lee' fixtures/acme/payroll-preview.md
grep -q 'Sam Patel' fixtures/acme/payroll-preview.md
grep -qi 'example' fixtures/acme/payroll-preview.md
grep -qi 'dry-run' fixtures/acme/payroll-preview.md
grep -qi 'not' fixtures/acme/payroll-preview.md

echo "DOOR1 OK"
exit 0
