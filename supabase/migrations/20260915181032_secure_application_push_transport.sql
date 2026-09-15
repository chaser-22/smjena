-- pg_net is newly installed for this scheduler. Its transient request headers
-- contain one-use credentials and must not be readable by browser roles.
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all sequences in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
