# User registration tables

This project uses Supabase Auth for social logins. The following table keeps a mapping between authenticated users and the anonymous `uid` cookie used before sign up.

| Column     | Type        | Description |
|------------|-------------|----------------------------------------------|
| auth_uid   | uuid        | Primary key referencing `auth.users.id`. |
| uid        | uuid        | Anonymous identifier preserved from the cookie. |
| nickname   | text        | User chosen nickname displayed in the UI. |
| created_at | timestamptz | Timestamp when the record was inserted. |

The `auth.users` table managed by Supabase stores provider information such as email or OAuth provider. After a successful sign up, the application inserts a row into `user_meta` with the current `uid` so that existing data remains associated with the new account.
