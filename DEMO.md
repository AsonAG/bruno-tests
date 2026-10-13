# Demo: Bruno tests

Outline of the demo, about 30 minutes plus questions.

## Preparation

The Bruno app, the repository opened as collection, a sandbox user.

## 1. What is covered (3 min)

110 of 110 endpoints of the API Reference of the docs - and nothing outside it. Before, it was 180 of 280 across
all specifications, 59 of them requests to routes that no longer existed.

Show the API reference of the docs.

## 2. How the ids come in (5 min)

Show `collection.bru`. The environment file used to hold 37 GUIDs from one database - on any other machine every
request went nowhere.

Today it holds nothing for the sandbox - the address, identity provider and client of the sandbox are collection
variables, the tenant is the first one of the user.

A `script:pre-request` fetches the rest from the server. The login is OAuth2 with PKCE: on the first request Bruno
opens the sandbox login, keeps the token and refreshes it - nothing to copy, nothing in the repository.

## 3. Full run live (10 min)

Runner - Run Collection.

All 16 folders in one run, in the order of their dependencies: tenant, user, membership, division, employee, task,
webhook and payroll are created and changed; what the API can delete is deleted again. Every POST remembers the id it
created, the matching DELETE removes exactly that one. Payrolls, divisions and employees stay - the API does not
delete them (release notes); the run keeps them in its own division BruTest.

The runner shows every request with its assertions - no server error for any request, 2xx for every
request on the objects of the run. Requests for an object the tenant does not have are
skipped, the log says which id.

## 4. One folder (5 min)

Run the folder Payrolls on its own.

Requests for objects the local database does not have - documents, payouts, attachments - are skipped, the log
says which id is missing.

## 5. What came up in the backend (7 min)

| Finding | Effect |
| --- | --- |
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
