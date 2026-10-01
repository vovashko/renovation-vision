-- Admin account type (T25), part 1 of 2.
--
-- A new enum value can't be used in the transaction that adds it ("unsafe use of new value"),
-- and the CLI runs each migration file in its own transaction. So this file only adds the value;
-- 20260930000200_auth_hardening.sql, which references 'admin', runs after it has committed.

alter type public.account_type add value if not exists 'admin';
