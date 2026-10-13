# Ason Payroll API - Bruno tests

A [Bruno](https://www.usebruno.com/) collection with one request per endpoint of the
[API Reference](https://docs.asonpayroll.com/api) of the docs, one folder per tag. Only endpoints Ason offers - no
request and no script uses anything outside the API Reference.

## Start in the Bruno app

Prerequisites: the [Bruno app](https://www.usebruno.com/downloads) and a sandbox user (register on the sandbox, see the
[Quickstart](https://docs.asonpayroll.com/quickstart) of the docs)

1. Clone the repository and open the folder in Bruno (Open Collection):

   ```
   git clone https://github.com/AsonAG/bruno-tests.git
   ```

2. Choose the environment **sandbox** (top right) and send **Connect** (or run the whole collection). Bruno opens the login of the sandbox - log in with your sandbox
   user. Bruno keeps the token and refreshes it, there is nothing to copy or configure.

3. Run the collection (Runner) - or send any request on its own.

The collection uses the first tenant of your user (set `tenantIdentifier` in the environment to choose another
one) and resolves every other id - payroll, division, employee, period, ... - from the server.

**Your own instance:** choose the environment `production` and set the address of your API there; in the collection
settings (Auth) set the identity provider (authorization and token URL), the OIDC client and its callback URL of your
instance - talk to Ason for these values. (Bruno does not fill in variables in the login settings, so they are
entered there directly.)

## What a run does

The folders run in an order that respects their dependencies:

| # | Folder | What it does |
| --- | --- | --- |
| 1 | Connect | logs in |
| 2 | Tenants | creates a throwaway tenant, changes and deletes it |
| 3 | Users | creates a user, changes and deletes it |
| 4 | User Memberships | membership and invitations of a user of their own, removed again |
| 5 | Divisions | creates and changes a division |
| 6 | Employees | creates and changes an employee |
| 7-11 | Employee / Company case values, documents, changes | read the case data of the tenant |
| 12 | Tasks | creates a task, runs an action, sets an attribute, deletes both |
| 13 | Webhooks | creates a webhook, changes and deletes it |
| 14 | Payrun periods | payout and closing on the test payroll |
| 15 | WageTypes | copy, activate and rename wage types on the test payroll |
| 16 | Payrolls | creates a payroll, adds company data, changes it |
| 17 | Company case changes | reads the case changes |

**Test division and test payroll:** the run works in a division `BruTest` with a payroll `BruTest` - payrolls, company
data and employees of the run go there, the real divisions and payrolls of the tenant stay as they are. Both are
created on the first run and reused by every later run.

**What stays after a run:** the API deletes no payrolls, divisions, employees, case values or documents (see the
[release notes](https://docs.asonpayroll.com/release-notes): such data is corrected, not deleted). So every run leaves a
division `BruTest-<run>`, the payrolls `BruTest-<run>` and `BruTestSimple-<run>` (with the division it creates for
itself), an employee `brutest-<run>@example.org` and a copied wage type in the test payroll. Tenant, user, membership,
invitations, task and webhook of the run are deleted again.

**Assertions:** no request may answer with a server error (5xx). Requests on the objects of the run (create, update,
delete, set, ...) must succeed (2xx). Where the API answers with a defined error, the test checks exactly that error
(e.g. `CreatePayout` and `ClosePayrunPeriod` on a period without payrun: 400 with the message).

**Skipped requests:** in a run, a request for an object the tenant does not have - e.g. a document, payout or task of a
tenant that never ran a payrun - is skipped, the console says which id is missing.

## Structure

| File | |
| --- | --- |
| `collection.bru` | login (OAuth2 with PKCE, sandbox), resolving the ids, the assertion "no server error" |
| `environments/sandbox.bru` | address of the sandbox API, tenant (empty: the first one of your user) and test values |
| `environments/production.bru` | the same for your own instance |
| `Connect/` | the first request - it triggers the login |
| `<Folder>/*.bru` | one request per endpoint, named like the operation in the API Reference |

The scripts run in the safe mode of Bruno (the default): calls of their own go through `bru.sendRequest` with the token
of the login, no npm modules, no files.

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
