-- Cover foreign keys used by employer, rating, creator and replacement lookups.
create index payment_ledger_employer_id_idx on public.payment_ledger (employer_id);
create index ratings_created_by_idx on public.ratings (created_by);
create index ratings_employer_id_idx on public.ratings (employer_id);
create index ratings_worker_id_idx on public.ratings (worker_id);
create index shifts_created_by_idx on public.shifts (created_by);
create index shifts_replacement_of_idx on public.shifts (replacement_of) where replacement_of is not null;
