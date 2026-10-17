# Workflows and design notes

## Record lifecycle

```mermaid
stateDiagram-v2
    [*] --> Queued: worker saves on the phone
    Queued --> Pending: sync engine uploads to Supabase
    Pending --> Approved: supervisor approves
    Pending --> Rejected: supervisor rejects (with a comment)
    Rejected --> Pending: worker edits and resubmits (optional future step)
    Approved --> [*]
    Rejected --> [*]
```

Notes:
- A record is created as `pending` and can only be inserted by the worker who
  created it (`submitted_by = auth.uid()`), enforced by Row Level Security.
- Approving/rejecting is limited to `supervisor` and `admin`.
- The `notify_record_review` trigger writes a row into `notifications` for the
  submitter. The mobile app re-checks every 20 seconds while it is open and shows a
  phone notification for a review it has not announced yet (unread count on the tab).
- Offline rules on the capture screen: the record and its photos are always written to
  the phone first. "Save as draft" works with no connection (local only); "Save record"
  needs the server, so it is disabled offline with a banner telling the worker to save a
  draft instead. Queued records upload automatically when the connection returns.

## Field worker flow (mobile app)

```mermaid
sequenceDiagram
    participant W as Field worker
    participant App as Expo app
    participant DB as SQLite (on phone)
    participant SB as Supabase

    W->>App: Sign in
    App->>SB: signInWithPassword
    SB-->>App: session + profile

    W->>App: Capture record (type, GPS, photos)
    alt record not finished, or the phone is offline
        App->>DB: Insert into outbox (status = draft)
        Note over App,DB: Nothing is uploaded.<br/>Submit it later from My Records<br/>once there is signal.
    else record complete and online
        App->>DB: Insert into outbox (status = pending)
        App->>SB: Try upload (photos then record)
        alt online
            SB-->>App: OK
            App->>DB: Delete outbox row
        else connection drops mid-save
            App->>DB: Keep row for later
        end
    end

    Note over App,SB: Offline, "Save record" is disabled and the screen<br/>says why; "Save as draft" always works because<br/>it only writes to the phone.
    Note over App,SB: When the connection comes back, the app<br/>uploads everything pending by itself.

    W->>App: Open Notifications
    App->>SB: select notifications (unread)
    SB-->>App: review messages
    Note over App,SB: While the app is open it re-checks every 20s<br/>and raises a phone notification for new reviews;<br/>the tab shows an unread badge.
```

## Supervisor / admin flow (web dashboard)

```mermaid
sequenceDiagram
    participant S as Supervisor
    participant Web as Next.js dashboard
    participant SB as Supabase

    S->>Web: Sign in
    Web->>SB: getUser + profiles (role)
    SB-->>Web: profile

    S->>Web: Open Dashboard
    Web->>SB: select records + zones
    SB-->>Web: data (RLS: read all)
    Web-->>S: charts incl. by-zone breakdown

    S->>Web: Open a pending record
    Web->>SB: update status + feedback + reviewed_by
    Note over SB: trigger stamps reviewed_at\nand inserts a notification
    SB-->>Web: OK

    S->>Web: Export CSV / hazard PDF
    Web->>SB: select records (same filters)
    Web-->>S: file download
```

## Roles and permissions matrix

| Action | Field worker | Supervisor | Admin |
| --- | --- | --- | --- |
| Sign in (mobile + web) | Yes | Yes | Yes |
| Create a record | Yes (own) | Yes (own) | Yes (own) |
| Read all records | Yes | Yes | Yes |
| Approve / reject a record | No | Yes | Yes |
| Delete a record | Yes (own, while pending) | No | Yes |
| Manage zones | No | No | Yes |
| Manage users / roles / deactivation | No | No | Yes |
| Export CSV / PDF | No | Yes | Yes |

## Naming conventions

- Database: `snake_case` tables and columns; enums in singular (`record_type`).
- TypeScript: `PascalCase` for types/components, `camelCase` for functions/variables.
- Files: `PascalCase.tsx` for components and screens, `kebab/camel.ts` for helpers.
