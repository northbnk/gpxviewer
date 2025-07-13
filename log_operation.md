# log_operation table

This table stores logs for user operations performed via the API.

| Column      | Type      | Description                                |
|-------------|-----------|--------------------------------------------|
| id          | UUID      | Primary key, generated automatically.      |
| uid         | UUID      | Anonymous user identifier from cookie.     |
| operation   | text      | Name of the performed operation.          |
| details     | text      | JSON-encoded extra information.           |
| created_at  | timestamptz | Time when the record was inserted.        |

The application writes to this table on various API actions such as
uploading, parsing, listing or deleting GPX files. The `details`
column may contain information like the GPX id or filename depending
on the operation.
