# Demo: Bruno tests

Outline of the demo, about 30 minutes plus questions.

## Preparation

```
dotnet run -c Release --project Ason.Payroll.Api.Server --launch-profile Api.Server
npm install
```

The tenant in `environments/api.bru` is set to `Demo Switzerland AG`.

## 1. What is covered (3 min)

119 of 119 endpoints of the Integration specification. Before, it was 180 of 280 across all specifications,
59 of them requests to routes that no longer existed.

Show Swagger: https://localhost:44354/index.html

## 2. How the ids come in (5 min)

Show `collection.bru`. The environment file used to hold 37 GUIDs from one database - on any other machine every
request went nowhere.

Today it holds two lines:

```
baseURL:          https://localhost:44354/api/
tenantIdentifier: Demo Switzerland AG
```

A `script:pre-request` fetches the rest from the server on the first request.

## 3. Full run live (10 min)

```
npm test
```

All 16 folders in one run, in the order of their dependencies: tenant, user, membership, division, employee, task,
webhook and payroll are created, changed, given attributes - and deleted again. Every POST remembers the id it
created, the matching DELETE removes exactly that one. After the run the database is as before.

Open `results/report.html`: every request with its assertions - no server error for any request, 2xx for every
request on the objects of the run. On "Demo Switzerland AG": 120 requests, 99 passed, 19 skipped (the object is not
in the database, the log says which id), 2 failed - the backend finding "Case value cache is not loaded".

## 4. One folder (5 min)

```
npm run test:folder -- Payrolls
```

Requests for objects the local database does not have - documents, payouts, attachments - are skipped, the log
says which id is missing.

## 5. What came up in the backend (7 min)

| Finding | Effect |
| --- | --- |
| `EmployeeController` has no DELETE | a created employee stays forever and blocks deleting its division |
| `DELETE payrolls/{id}` does not delete the layers and payruns | foreign key error - the collection deletes them first |
| `cases/values/time` and `cases/values/count` of a payroll | 500 "Case value cache is not loaded" |
| `DELETE tenants/{id}` too slow | 33 DELETE statements over JOINs instead of over the TenantId, plus five retries on timeout |
| 500 instead of 404 for an unknown id | `ArgumentOutOfRangeException` reaches the client |

Plus three properties of the API that are not documented:

* a PUT needs the `id` in the body as well
* an attribute value is JSON in JSON: `"\"Testvalue\""`
* the role of a membership is polymorphic: `"role": { "$type": "Admin" }`

## 6. What is open

* Payrun periods, payouts and invitations cannot be created through the Integration API - that takes a tenant
  that ran a payrun once.
* Creating an employee case change: there is no request for it yet, so `DeleteEmployeeCaseChange` has nothing to
  delete.
