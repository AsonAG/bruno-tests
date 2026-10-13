# Ason Payroll Integration API - Bruno tests

A [Bruno](https://www.usebruno.com/) collection with one request per endpoint of the API Reference of the docs
(the Integration API, `/swagger/Integration/swagger.json`), one folder per tag. Only endpoints Ason offers - no request
and no script uses anything outside the API Reference.

## Setup

1. Install the Bruno CLI (once, in this folder):

   ```
   npm install
   ```

2. Your access token - copy `.env.sample` to `.env` and set it (`.env` is not committed):

   ```
   ASON_ACCESS_TOKEN=<your token>
   ```

   - **Sandbox:** log in on the Quickstart of the docs and click "Copy my sandbox token" - it copies the whole line.
     The token of a login is valid for a limited time; when the run answers 401, copy a new one.
   - **Production / your own instance:** the system user token Ason issued for your tenant.

   Every request sends it as `Authorization: Bearer <token>`. Without it the run stops on the first request.

3. Your tenant in `environments/sandbox.bru` (or `environments/production.bru` with the address of your instance):

   ```
   baseURL:          https://sandbox-api.asonpayroll.com/api/
   tenantIdentifier: Acme Group
   ```

   That is all - the collection resolves every other id (payroll, division, employee, user, period, ...) from the
   server on its first request (`collection.bru`).

## Run everything

```
npm test
```

Runs all folders in one go against the sandbox and writes the results to `results/report.html` (and
`results/junit.xml` for a CI). Against your own instance: `npm run test:production`.

The folders run in an order that respects their dependencies:

| # | Folder | What it does |
| --- | --- | --- |
| 1 | Tenants | creates a throwaway tenant, changes and deletes it |
| 2 | Users | creates a user, changes and deletes it |
| 3 | User Memberships | membership and invitations of a user of their own, removed again |
| 4 | Divisions | creates and changes a division |
| 5 | Employees | creates and changes an employee |
| 6-10 | Employee / Company case values, documents, changes | read the case data of the tenant |
| 11 | Tasks | creates a task, runs an action, sets an attribute, deletes both |
| 12 | Webhooks | creates a webhook, changes and deletes it |
| 13 | Payrun periods | payout, cancel and close on the test payroll |
| 14 | WageTypes | copy, activate and rename wage types on the test payroll |
| 15 | Payrolls | creates a payroll, adds company data, changes it |
| 16 | Company case changes | reads the case changes |

**Test division and test payroll:** the run works in a division `BruTest` with a payroll `BruTest` - payrolls, company
data and employees of the run go there, the real divisions and payrolls of the tenant stay as they are. Both are
created on the first run and reused by every later run.

**What stays after a run:** the API deletes no payrolls, divisions, employees, case values or documents (see the release
notes of the docs: such data is corrected, not deleted). So every run leaves a division `BruTest-<run>`, the payrolls
`BruTest-<run>` and `BruTestSimple-<run>` (with the division it creates for itself) and an employee
`brutest-<run>@example.org`. Tenant, user, membership, invitations, task and webhook of the run are deleted again.

**Assertions:** no request may answer with a server error (5xx). Requests on the objects of the run (create, update,
delete, set, ...) must succeed (2xx).

**Skipped requests:** a request for an object the database does not have - e.g. a document, payout or task of a tenant
that never ran a payrun - is skipped, the log says which id is missing. With the placeholder id the server would answer
500 instead of 404.

## Run one folder

```
npm run test:folder -- Divisions
```

## Structure

| File | |
| --- | --- |
| `collection.bru` | resolves the ids once per run, the assertion "no server error" for every request |
| `environments/sandbox.bru`, `production.bru` | address of the API and tenant |
| `.env` | your access token `ASON_ACCESS_TOKEN` (not committed, see `.env.sample`) |
| `lib/api.js` | helpers of the scripts: API calls outside the request, the test division, the test payroll, the test period |
| `<Folder>/*.bru` | one request per endpoint, named like the operation in the specification |

The scripts call the API themselves (axios, with the same token), so the CLI needs `--sandbox developer` (set in
`package.json`). In the Bruno app: Collection settings - Script sandbox - Developer mode; the app reads `.env` too.

## Findings in the backend

| Finding | Effect |
| --- | --- |
| `cases/values/time` and `cases/values/count` of a payroll | 500 "Case value cache is not loaded" |
| `CreatePayout` on a period without payrun | 400 "Payout without entries" - expected, the test payroll never ran a payrun |
| `DELETE tenants/{id}` is slow | 33 DELETE statements over JOINs instead of over the TenantId, plus five retries on timeout |
| 500 instead of 404 for an unknown id | `ArgumentOutOfRangeException` reaches the client |

Undocumented properties of the API:

* a PUT needs the `id` in the body as well
* an attribute value is JSON in JSON: `"\"Testvalue\""`
* the role of a membership is polymorphic: `"role": { "$type": "Admin" }`
