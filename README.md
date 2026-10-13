# Ason Payroll Integration API - Bruno tests

A [Bruno](https://www.usebruno.com/) collection with one request per endpoint of the Integration API
(`/swagger/Integration/swagger.json`), one folder per tag of the specification.

## Setup

1. Start the backend locally:

   ```
   dotnet run -c Release --project Ason.Payroll.Api.Server --launch-profile Api.Server
   ```

2. Install the Bruno CLI (once, in this folder):

   ```
   npm install
   ```

3. Set the tenant in `environments/api.bru`:

   ```
   baseURL:          https://localhost:44354/api/
   tenantIdentifier: Demo Switzerland AG
   ```

   That is all - the collection resolves every other id (payroll, division, employee, user, period, ...) from the
   server on its first request (`collection.bru`).

## Run everything

```
npm test
```

Runs all folders in one go and writes the results to `results/report.html` (and `results/junit.xml` for a CI).

The folders run in an order that respects their dependencies:

| # | Folder | What it does |
| --- | --- | --- |
| 1 | Tenants | creates a throwaway tenant, changes and deletes it |
| 2 | Users | creates a user, changes and deletes it |
| 3 | User Memberships | membership and invitations of a user of their own |
| 4 | Divisions | creates a division, sets an attribute, deletes both |
| 5 | Employees | creates and changes an employee (the API has no delete) |
| 6-10 | Employee / Company case values, documents, changes | read the case data of the tenant |
| 11 | Tasks | creates a task, runs an action, sets an attribute, deletes both |
| 12 | Webhooks | creates a webhook, changes and deletes it |
| 13 | Payrun periods | payout, cancel and close on the test payroll |
| 14 | WageTypes | copy and activate wage types on the test payroll |
| 15 | Payrolls | creates a payroll, adds a case, changes and deletes it - and the test payroll of 13 and 14 |
| 16 | Company case changes | deletes the case change added by Payrolls |

Every object a request creates gets the name `BruTest-<run>` and its id is remembered; the matching update and
delete use exactly that id. After a full run the database is as before - except the employee `brutest-<run>@example.org`
(the API has no delete for employees).

**Assertions:** no request may answer with a server error (5xx). Requests on the objects of the run (create, update,
delete, set, ...) must succeed (2xx).

**Skipped requests:** a request for an object the database does not have - e.g. a document, payout or task of a tenant
that never ran a payrun - is skipped, the log says which id is missing. With the placeholder id the server would answer
500 instead of 404.

Result on the tenant "Demo Switzerland AG" (local database): 120 requests - 99 passed, 19 skipped, 2 failed:
`GetPayrollTimeCaseValues` and `GetPayrollCaseValueCount` answer 500 "Case value cache is not loaded" (finding in
the backend, see below).

## Run one folder

```
npm run test:folder -- Divisions
```

Payrun periods and WageTypes create their test payroll themselves when they run alone; the next run deletes it.

## Structure

| File | |
| --- | --- |
| `collection.bru` | resolves the ids once per run, the assertion "no server error" for every request |
| `environments/api.bru` | address of the API and tenant; the other ids are placeholders, filled at run time |
| `lib/api.js` | helpers of the scripts: API calls outside the request, the test payroll, the test period |
| `<Folder>/*.bru` | one request per endpoint, named like the operation in the specification |

The scripts call the API themselves (axios), so the CLI needs `--sandbox developer` (set in `package.json`). In the
Bruno app: Collection settings - Script sandbox - Developer mode.

## Findings in the backend

| Finding | Effect |
| --- | --- |
| `EmployeeController` has no DELETE | a created employee stays and blocks deleting its division |
| `DELETE payrolls/{id}` does not delete the layers and payruns | foreign key error - the collection deletes them first (`lib/api.js`, `DeletePayroll`) |
| `cases/values/time` and `cases/values/count` of a payroll | 500 "Case value cache is not loaded" |
| `CreatePayout` on a period without payrun | 400 "Payout without entries" - expected, the test payroll never ran a payrun |
| `DELETE tenants/{id}` is slow | 33 DELETE statements over JOINs instead of over the TenantId, plus five retries on timeout |
| 500 instead of 404 for an unknown id | `ArgumentOutOfRangeException` reaches the client |

Undocumented properties of the API:

* a PUT needs the `id` in the body as well
* an attribute value is JSON in JSON: `"\"Testvalue\""`
* the role of a membership is polymorphic: `"role": { "$type": "Admin" }`
