# mini-learning-course

## Security

Admin access is identified by the verified Supabase Auth `app_metadata.role` claim set to `admin`. Row-level security policies enforce admin and per-user access in PostgreSQL; the browser check only controls the admin interface. Create the admin user and assign its app metadata in trusted Supabase tooling. Never commit passwords, service-role keys, or `.env` files. See [docs/supabase-setup.md](docs/supabase-setup.md) and [docs/security-fix.sql](docs/security-fix.sql) for setup and policies.