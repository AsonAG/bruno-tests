// Shared helpers for the scripts of the collection: calls to the API outside of the request itself, e.g. to look up an
// id at run time. Only endpoints of the API Reference. Needs the developer sandbox (bru run ... --sandbox developer).

const axios = require("axios");

// the name of the test division and the test payroll - created once per tenant and reused by every run
const TEST_NAME = "BruTest";

// the access token: ASON_ACCESS_TOKEN from the file .env in the collection folder (or the environment of the process)
function accessToken(bru) {
  return bru.getProcessEnv("ASON_ACCESS_TOKEN") || "";
}

// API client for the base URL of the environment: get / post / put / del with a path below it ("tenants/..."), with the
// access token of the run
function client(bru) {
  const base = (bru.getEnvVar("baseURL") || "").replace(/\/+$/, "");
  const config = (timeout = 180000) => ({ timeout, headers: { Authorization: `Bearer ${accessToken(bru)}` } });
  return {
    base,
    get: async (path, timeout) => (await axios.get(`${base}/${path}`, config(timeout))).data,
    post: async (path, body, timeout) => (await axios.post(`${base}/${path}`, body, config(timeout))).data,
    put: async (path, body, timeout) => (await axios.put(`${base}/${path}`, body, config(timeout))).data,
    del: async (path, timeout) => (await axios.delete(`${base}/${path}`, config(timeout))).data,
  };
}

// a list from the API: an array, { items: [...] } or a single object
function items(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  return [data];
}

// the regulations of a test payroll - without them it has neither cases nor wage types
async function assignRegulations(api, tenantId, payrollId) {
  await api.put(`tenants/${tenantId}/payrolls/${payrollId}/regulations`, {
    countryRegulation: "CH.Swissdec",
    industries: [],
    erp: [],
    accountingDocument: "AccountingDocument1",
    accountingData: "CH.AccountingDataKMU",
  });
}

// The test division: payrolls, case data and employees of the run go there, so the real divisions of the tenant stay
// as they are. The API cannot delete a division, so it is created once and reused (name BruTest).
async function ensureTestDivision(bru) {
  if (bru.getVar("testDivisionId")) return bru.getVar("testDivisionId");
  const api = client(bru);
  const tenantId = bru.getVar("tenantId");
  try {
    let division = items(await api.get(`tenants/${tenantId}/divisions`)).find((x) => x.name === TEST_NAME);
    if (!division) {
      division = await api.post(`tenants/${tenantId}/divisions`, { name: TEST_NAME, culture: "de-CH" });
      console.log(`test division created: ${division.id}`);
    }
    bru.setVar("testDivisionId", division.id);
    return division.id;
  } catch (e) {
    console.log(`test division could not be set up: ${e.message}`);
    return null;
  }
}

// The test payroll for requests that change a payroll (payouts, closing a period, wage types), so nothing changes on a
// real payroll. The API cannot delete a payroll, so it is created once in the test division and reused (name BruTest).
async function ensureTestPayroll(bru) {
  if (bru.getVar("testPayrollId")) return bru.getVar("testPayrollId");
  const api = client(bru);
  const tenantId = bru.getVar("tenantId");
  const divisionId = await ensureTestDivision(bru);
  if (!divisionId) return null;
  try {
    let payroll = items(await api.get(`tenants/${tenantId}/payrolls`)).find((x) => x.name === TEST_NAME);
    if (!payroll) {
      payroll = await api.post(`tenants/${tenantId}/payrolls`, {
        name: TEST_NAME,
        divisionId,
        calendarCalculationMode: "MonthCalendarDay",
        country: 756,
        language: "German",
        accountingStartDate: "2026-01-01T00:00:00Z",
      });
      await assignRegulations(api, tenantId, payroll.id);
      console.log(`test payroll created: ${payroll.id}`);
    }
    bru.setVar("testPayrollId", payroll.id);
    return payroll.id;
  } catch (e) {
    console.log(`test payroll could not be set up: ${e.message}`);
    return null;
  }
}

// an open payrun period of the test payroll - so nothing changes on a real pay period
async function loadTestPeriod(bru) {
  const api = client(bru);
  try {
    const periods = items(await api.get(`tenants/${bru.getVar("tenantId")}/payrolls/${bru.getVar("testPayrollId")}/payrunperiods`, 60000));
    const open = periods.find((x) => !x.closedAt) || periods[periods.length - 1];
    if (open) bru.setVar("testPeriodId", open.id);
  } catch (e) {
    console.log(`test period could not be read: ${e.message}`);
  }
}

module.exports = { TEST_NAME, accessToken, client, items, assignRegulations, ensureTestDivision, ensureTestPayroll, loadTestPeriod };
