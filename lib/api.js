// Shared helpers for the scripts of the collection: calls to the API outside of the request itself, e.g. to create
// a test payroll or to look up an id at run time. Needs the developer sandbox (bru run ... --sandbox developer).

const axios = require("axios");

// localhost uses a self-signed certificate
let agent = null;
try {
  const https = require("https");
  agent = new https.Agent({ rejectUnauthorized: false });
} catch (e) {
  console.log("no https module - run with --sandbox developer");
}

// API client for the base URL of the environment: get / post / put / del with a path below it ("tenants/...")
function client(bru) {
  const base = (bru.getEnvVar("baseURL") || "https://localhost:44354/api/").replace(/\/+$/, "");
  const config = (timeout = 180000) => (agent ? { timeout, httpsAgent: agent } : { timeout });
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

// The test payroll for requests that change a payroll (payouts, closing a period, wage types): created once per run
// and shared, so nothing changes on a real payroll. Payrolls/DeletePayroll deletes it at the end of the run.
async function ensureTestPayroll(bru) {
  if (bru.getVar("createdPayrollId")) return bru.getVar("createdPayrollId");
  const api = client(bru);
  const tenantId = bru.getVar("tenantId");
  // the test payrolls of earlier runs of a single folder (nothing deletes them there)
  try {
    const own = `BruTest-${bru.getVar("runId")}-shared`;
    for (const old of items(await api.get(`tenants/${tenantId}/payrolls`)).filter((x) => /^BruTest-\d+-shared$/.test(x.name) && x.name !== own)) {
      await deletePayroll(bru, old.id);
    }
  } catch (e) {
    console.log(`earlier test payrolls could not be read: ${e.message}`);
  }
  try {
    const payroll = await api.post(`tenants/${tenantId}/payrolls`, {
      name: `BruTest-${bru.getVar("runId")}-shared`,
      divisionId: bru.getVar("divisionId"),
      calendarCalculationMode: "MonthCalendarDay",
      country: 756,
      language: "German",
      accountingStartDate: "2026-01-01T00:00:00Z",
    });
    bru.setVar("createdPayrollId", payroll.id);
    await assignRegulations(api, tenantId, payroll.id);
    console.log(`test payroll created: ${payroll.id}`);
    return payroll.id;
  } catch (e) {
    console.log(`test payroll could not be created: ${e.message}`);
    return null;
  }
}

// the first payrun period of the test payroll - so nothing changes on a real pay period
async function loadTestPeriod(bru) {
  const api = client(bru);
  try {
    const periods = items(await api.get(`tenants/${bru.getVar("tenantId")}/payrolls/${bru.getVar("createdPayrollId")}/payrunperiods?top=1`, 60000));
    if (periods.length) bru.setVar("testPeriodId", periods[0].id);
  } catch (e) {
    console.log(`test period could not be read: ${e.message}`);
  }
}

// What blocks deleting a payroll: its payruns and its layers (the regulations) - DELETE payrolls/{id} does not delete
// them and fails on the foreign keys, so they are deleted first.
async function deletePayrollDependents(bru, payrollId) {
  const api = client(bru);
  const tenant = `tenants/${bru.getVar("tenantId")}`;
  try {
    for (const payrun of items(await api.get(`${tenant}/payruns`)).filter((x) => x.payrollId === payrollId)) {
      await api.del(`${tenant}/payruns/${payrun.id}`);
    }
    for (const layer of items(await api.get(`${tenant}/payrolls/${payrollId}/layers`))) {
      await api.del(`${tenant}/payrolls/${payrollId}/layers/${layer.id}`);
    }
  } catch (e) {
    console.log(`payruns or layers of payroll ${payrollId} could not be deleted: ${e.message}`);
  }
}

// a payroll of the run with everything that blocks deleting it - and its division, if the run created that too
async function deletePayroll(bru, payrollId, divisionId) {
  const api = client(bru);
  const tenant = `tenants/${bru.getVar("tenantId")}`;
  await deletePayrollDependents(bru, payrollId);
  try {
    await api.del(`${tenant}/payrolls/${payrollId}`);
    console.log(`payroll deleted: ${payrollId}`);
    if (divisionId) {
      await api.del(`${tenant}/divisions/${divisionId}`);
      console.log(`division deleted: ${divisionId}`);
    }
  } catch (e) {
    console.log(`payroll ${payrollId} could not be deleted: ${e.message}`);
  }
}

module.exports = { client, items, assignRegulations, ensureTestPayroll, loadTestPeriod, deletePayrollDependents, deletePayroll };
