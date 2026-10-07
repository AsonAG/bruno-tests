# Vorfuehrung Bruno-Tests

Ablauf fuer die Demo, etwa 30 Minuten plus Fragen.

## Vorbereitung

```
dotnet run -c Release --project Ason.Payroll.Api.Server --launch-profile Api.Server
npm install -g @usebruno/cli
```

Mandant in `environments/api.bru` steht auf `Muster`.

## 1. Was abgedeckt ist (3 min)

119 von 119 Endpunkten der Integration-Spezifikation. Vorher waren es 180 von 280
quer ueber alle Spezifikationen, davon 59 Requests auf Routen, die es nicht mehr gab.

Swagger offen zeigen: https://localhost:44354/index.html

## 2. Wie die Ids hereinkommen (5 min)

`collection.bru` zeigen. Frueher standen 37 GUIDs aus einer Datenbank in der
Umgebungsdatei - bei jedem anderen Rechner liefen alle Requests ins Leere.

Heute stehen dort zwei Zeilen:

```
baseURL:          https://localhost:44354/api/
tenantIdentifier: Muster
```

Den Rest holt ein `script:pre-request` beim ersten Request vom Server.

## 3. Lebenszyklus live (10 min)

```
bru run lebenszyklus --env api --insecure --sandbox developer
```

24 Schritte: Division, Payroll, Task, Webhook, User und Mitgliedschaft anlegen,
jeweils aendern, Attribute setzen - dann alles in umgekehrter Reihenfolge loeschen.
Jedes POST merkt sich die erzeugte Id, das passende DELETE raeumt genau die weg.
Nach dem Lauf ist die Datenbank wie vorher.

## 4. Lesender Lauf (5 min)

```
bru run get -r --env api --insecure --sandbox developer
```

72 Requests, 56 mit 200. Die uebrigen 16 fragen nach Objekten, die es in der
lokalen Datenbank nicht gibt - Dokumente, Payouts, Anhaenge, Einladungen.

## 5. Was dabei im Backend aufgefallen ist (7 min)

| Befund | Wirkung |
| --- | --- |
| `EmployeeController` hat keinen DELETE | ein angelegter Mitarbeiter bleibt fuer immer und blockiert das Loeschen seiner Division |
| `DELETE payrolls/{id}` loescht den PayrollLayer nicht mit | Fremdschluesselfehler, der Layer muss vorher weg |
| `DELETE tenants/{id}` zu langsam | 33 DELETE-Anweisungen ueber JOINs statt ueber TenantId, dazu fuenf Wiederholungen bei Timeout |
| 500 statt 404 bei unbekannter Id | `ArgumentOutOfRangeException` dringt bis zum Client durch |

Dazu drei Eigenheiten der API, die nicht dokumentiert sind:

* ein PUT braucht die `id` auch im Body
* ein Attributwert ist JSON in JSON: `"\"Testwert\""`
* eine Mitgliedschaftsrolle ist polymorph: `"role": { "$type": "Admin" }`

## 6. Was offen ist

* Payrun-Perioden, Payouts und Einladungen lassen sich ueber die
  Integration-Schnittstelle nicht herstellen - dafuer braucht es einen Mandanten,
  durch den einmal ein Lohnlauf gelaufen ist.
* Die Requests in `post`, `put`, `patch` und `delete` laufen einzeln nicht sauber,
  weil die Abhaengigkeiten quer ueber die Methoden gehen. Dafuer gibt es den
  `lebenszyklus`.
* Zusicherungen fehlen: die Sammlung prueft noch keinen Statuscode automatisch.
