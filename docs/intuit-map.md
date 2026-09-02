# Official Intuit map (Door 1)

This connector follows published Intuit contracts. Door 1 proves the map with the Acme Bookkeeping fixture and placeholder BYOK env. It does not submit an Intuit App Store listing, does not ship production keys, and does not auto-submit payroll.

## OAuth 2.0

Docs:

- https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-openid-discovery-doc

Live discovery JSON (fetched for this repo; public endpoints only):

- Production: https://developer.api.intuit.com/.well-known/openid_configuration
- Sandbox: https://developer.api.intuit.com/.well-known/openid_sandbox_configuration

Recorded copy: `fixtures/acme/discovery.json`

| Step | Official contract |
| --- | --- |
| Authorize | `GET https://appcenter.intuit.com/connect/oauth2` with `client_id`, `scope`, `redirect_uri`, `response_type=code`, `state` |
| Accounting scope | `com.intuit.quickbooks.accounting` |
| Callback | `code`, `realmId`, matching `state` |
| Token | `POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` |
| Token auth | `Authorization: Basic base64(client_id:client_secret)` (`client_secret_basic`) |
| Token body | `grant_type=authorization_code&code=...&redirect_uri=...` |
| Refresh | same token URL, `grant_type=refresh_token` |
| API header | `Authorization: bearer {access_token}` |
| Access token TTL | `expires_in` starts at 3600 seconds |

Use your own Intuit app keys. Leave `.env.example` placeholders to stay on the fixture path.

## Accounting REST (company + employees)

Docs:

- https://developer.intuit.com/app/developer/qbo/docs/learn/rest-api-features
- https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/companyinfo
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/employee

| Tool | Official request |
| --- | --- |
| `qbo_read_company` | `GET {base}/v3/company/{realmId}/companyinfo/{realmId}?minorversion=75` |
| `qbo_list_employees` | `GET {base}/v3/company/{realmId}/query?query=SELECT * FROM Employee&minorversion=75` |
| Employee write | `POST {base}/v3/company/{realmId}/employee` sparse update |

Hosts: `https://sandbox-quickbooks.api.intuit.com` (sandbox) or `https://quickbooks.api.intuit.com` (production).

The Accounting `Employee` entity has names, active flag, and optional `BillRate` (hourly billing). It does **not** carry annual salary. Pay rates are a Payroll Compensation resource.

## Payroll API (pay rates + payroll run)

Docs:

- https://developer.intuit.com/app/developer/payroll-time/docs/get-started
- https://developer.intuit.com/app/developer/payroll-time/docs/develop/develop-payroll
- https://developer.intuit.com/app/developer/payroll-time/docs/learn/learn-about-scopes
- https://developer.intuit.com/app/developer/payroll-time/docs/workflows/payroll-payslips
- https://developer.intuit.com/app/developer/qbo/docs/learn/premium-apis

| Need | Official resource | Door 1 |
| --- | --- | --- |
| Pay types / rates | GraphQL `payrollEmployeeCompensations` at `https://qb.api.intuit.com/graphql` | Recorded fixture `fixtures/acme/payroll-compensations.json` |
| Scope | `payroll.compensation.read` (Silver+ partner; enable under Restricted scopes) | Not requested on the fixture path |
| Sandbox | Workforce API is **not available in sandbox**; production keys required | Fixture only — no production keys in this repo |
| Payroll run | Payslips (`payrollPayslips`) appear after a human runs payroll in QuickBooks. Webhooks can notify. There is no public create-payroll-run mutation. | Preview totals + status `submitted: false` |

`qbo_update_employee_salary` updates the fixture compensation overlay (example annual, round teaching numbers). Confirm-screen defaults on. It never posts a payroll run.

## Dump the request map

```bash
node dist/index.js intuit-map
```
