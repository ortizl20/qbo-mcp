/**
 * Official Intuit QuickBooks Online contracts fetched from developer.intuit.com
 * and the published OAuth discovery documents.
 *
 * Door 1 never sends these requests on the prove path. Builders exist so the
 * fixture map matches the live BYOK requests an agent would make later.
 */

export const INTUIT_DOCS = {
  oauth20:
    "https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0",
  discovery:
    "https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-openid-discovery-doc",
  discoveryProduction: "https://developer.api.intuit.com/.well-known/openid_configuration",
  discoverySandbox: "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration",
  accountingRest: "https://developer.intuit.com/app/developer/qbo/docs/learn/rest-api-features",
  dataQueries: "https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries",
  minorVersions: "https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions",
  employee: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/employee",
  companyInfo: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/companyinfo",
  workforceGetStarted: "https://developer.intuit.com/app/developer/payroll-time/docs/get-started",
  workforceDevelop: "https://developer.intuit.com/app/developer/payroll-time/docs/develop/develop-payroll",
  workforceScopes: "https://developer.intuit.com/app/developer/payroll-time/docs/learn/learn-about-scopes",
  payslips: "https://developer.intuit.com/app/developer/payroll-time/docs/workflows/payroll-payslips",
  premiumApis: "https://developer.intuit.com/app/developer/qbo/docs/learn/premium-apis",
} as const;

/** Values from GET https://developer.api.intuit.com/.well-known/openid_configuration */
export const INTUIT_OAUTH = {
  issuer: "https://oauth.platform.intuit.com/op/v1",
  authorizationEndpoint: "https://appcenter.intuit.com/connect/oauth2",
  tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  revocationEndpoint: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
  userinfoProduction: "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
  userinfoSandbox: "https://sandbox-accounts.platform.intuit.com/v1/openid_connect/userinfo",
  tokenEndpointAuthMethods: ["client_secret_basic", "client_secret_post"] as const,
  responseType: "code",
} as const;

export const INTUIT_SCOPES = {
  /** Required for QBO Accounting REST (CompanyInfo, Employee). */
  accounting: "com.intuit.quickbooks.accounting",
  /**
   * Premium Payroll Compensation GraphQL (payrollEmployeeCompensations).
   * Silver+ partner tier. Not available in sandbox.
   */
  payrollCompensationRead: "payroll.compensation.read",
  qbEmployeeRead: "qb.employee.read",
  /** Payslips after a company runs payroll in QuickBooks. */
  qbPayrollCompensationRead: "qb.payroll.compensation.read",
} as const;

export const INTUIT_API = {
  accountingSandbox: "https://sandbox-quickbooks.api.intuit.com",
  accountingProduction: "https://quickbooks.api.intuit.com",
  workforceGraphql: "https://qb.api.intuit.com/graphql",
  /** Current minor version cited in Accounting REST docs. */
  minorVersion: "75",
} as const;

export const PAYROLL_EMPLOYEE_COMPENSATIONS_QUERY = `query getEmployeeCompensations($filter: Payroll_EmployeeCompensationsFilter!) {
  payrollEmployeeCompensations(filter: $filter) {
    edges {
      node {
        id
        active
        employerCompensation {
          id
          name
          type { key description value }
        }
      }
    }
  }
}`;

export const PAYROLL_PAYSLIPS_QUERY = `query getPayrollPayslips {
  payrollPayslips {
    edges {
      node {
        id
        payPeriod { beginDate endDate }
        grossPay { currentAmount yearToDateAmount }
      }
    }
  }
}`;

export interface OfficialHttpRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
  doc: string;
  note: string;
}

export function accountingBase(env: "sandbox" | "production"): string {
  return env === "production" ? INTUIT_API.accountingProduction : INTUIT_API.accountingSandbox;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  extraScopes?: string[];
}): string {
  const scopes = [INTUIT_SCOPES.accounting, ...(params.extraScopes ?? [])].join(" ");
  const url = new URL(INTUIT_OAUTH.authorizationEndpoint);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", INTUIT_OAUTH.responseType);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export function buildTokenExchangeRequest(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): OfficialHttpRequest {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`, "utf8").toString("base64");
  return {
    method: "POST",
    url: INTUIT_OAUTH.tokenEndpoint,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
      "x-include-refresh-token-hard-expires-in": "true",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    }).toString(),
    doc: INTUIT_DOCS.oauth20,
    note: "Exchange authorization code once. Multiple exchanges can invalidate tokens.",
  };
}

export function buildRefreshTokenRequest(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): OfficialHttpRequest {
  const basic = Buffer.from(`${params.clientId}:${params.clientSecret}`, "utf8").toString("base64");
  return {
    method: "POST",
    url: INTUIT_OAUTH.tokenEndpoint,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
      "x-include-refresh-token-hard-expires-in": "true",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    }).toString(),
    doc: INTUIT_DOCS.oauth20,
    note: "Always persist the latest refresh_token from the response.",
  };
}

export function buildCompanyInfoRequest(params: {
  env: "sandbox" | "production";
  realmId: string;
  accessToken: string;
}): OfficialHttpRequest {
  const base = accountingBase(params.env);
  return {
    method: "GET",
    url: `${base}/v3/company/${params.realmId}/companyinfo/${params.realmId}?minorversion=${INTUIT_API.minorVersion}`,
    headers: {
      Accept: "application/json",
      Authorization: `bearer ${params.accessToken}`,
    },
    doc: INTUIT_DOCS.companyInfo,
    note: "Accounting REST read of CompanyInfo. Sandbox host when INTUIT_ENV=sandbox.",
  };
}

export function buildEmployeeQueryRequest(params: {
  env: "sandbox" | "production";
  realmId: string;
  accessToken: string;
}): OfficialHttpRequest {
  const base = accountingBase(params.env);
  const query = encodeURIComponent("SELECT * FROM Employee");
  return {
    method: "GET",
    url: `${base}/v3/company/${params.realmId}/query?query=${query}&minorversion=${INTUIT_API.minorVersion}`,
    headers: {
      Accept: "application/json",
      Authorization: `bearer ${params.accessToken}`,
    },
    doc: INTUIT_DOCS.dataQueries,
    note: "Accounting REST query. Employee does not expose annual salary; that lives on Payroll Compensation.",
  };
}

export function buildEmployeeSparseUpdateRequest(params: {
  env: "sandbox" | "production";
  realmId: string;
  accessToken: string;
  employeeId: string;
  syncToken: string;
  displayName: string;
}): OfficialHttpRequest {
  const base = accountingBase(params.env);
  return {
    method: "POST",
    url: `${base}/v3/company/${params.realmId}/employee?minorversion=${INTUIT_API.minorVersion}`,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      sparse: true,
      Id: params.employeeId,
      SyncToken: params.syncToken,
      DisplayName: params.displayName,
    }),
    doc: INTUIT_DOCS.employee,
    note: "Accounting Employee sparse update. Not a payroll submit. Annual salary is not an Employee field.",
  };
}

export function buildCompensationQueryRequest(params: {
  accessToken: string;
  employeeId: string;
}): OfficialHttpRequest {
  return {
    method: "POST",
    url: INTUIT_API.workforceGraphql,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      query: PAYROLL_EMPLOYEE_COMPENSATIONS_QUERY,
      variables: { filter: { employeeId: params.employeeId, active: true } },
    }),
    doc: INTUIT_DOCS.workforceDevelop,
    note: "Premium GraphQL. Not available in sandbox. Door 1 uses a recorded fixture instead of production keys.",
  };
}

export function buildPayslipQueryRequest(params: { accessToken: string }): OfficialHttpRequest {
  return {
    method: "POST",
    url: INTUIT_API.workforceGraphql,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ query: PAYROLL_PAYSLIPS_QUERY }),
    doc: INTUIT_DOCS.payslips,
    note: "Payslips exist after a company runs payroll in QuickBooks. There is no public create-payroll-run mutation. Door 1 previews only.",
  };
}

export function redactRequest(request: OfficialHttpRequest): OfficialHttpRequest {
  const headers = { ...request.headers };
  if (headers.Authorization) headers.Authorization = "REDACTED";
  return { ...request, headers };
}

export function officialRequestMap(params: {
  env: "sandbox" | "production";
  clientId: string;
  redirectUri: string;
  realmId: string;
}): Record<string, unknown> {
  const authorizeUrl = buildAuthorizeUrl({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    state: "csrf-placeholder-not-a-secret",
  });
  return {
    docs: INTUIT_DOCS,
    oauth: {
      authorizeUrl,
      tokenEndpoint: INTUIT_OAUTH.tokenEndpoint,
      grantTypes: ["authorization_code", "refresh_token"],
      scope: INTUIT_SCOPES.accounting,
      responseType: INTUIT_OAUTH.responseType,
    },
    accounting: {
      companyInfo: redactRequest(
        buildCompanyInfoRequest({
          env: params.env,
          realmId: params.realmId,
          accessToken: "redacted",
        }),
      ),
      employeeSelect: "SELECT * FROM Employee",
      employeeQuery: redactRequest(
        buildEmployeeQueryRequest({
          env: params.env,
          realmId: params.realmId,
          accessToken: "redacted",
        }),
      ),
    },
    payroll: {
      compensations: redactRequest(buildCompensationQueryRequest({ accessToken: "redacted", employeeId: "emp-001" })),
      payslips: redactRequest(buildPayslipQueryRequest({ accessToken: "redacted" })),
      submitPayrollRun: null,
      sandboxWorkforce: false,
    },
  };
}
