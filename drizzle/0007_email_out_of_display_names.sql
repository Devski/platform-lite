-- #36: a display name that is the account's own e-mail address, published.
--
-- Registration used to seed users.name from the address's local part, and the
-- first profile write copied it into profiles.display_name. That string then
-- appeared on the public page, in the page title, and in the title of every
-- shared link — so "jan.kowalski@gmail.com" published as "jan.kowalski", and
-- the address was a confident guess from there.
--
-- Registration no longer invents a name, and onboarding asks for one. This
-- clears what the old flow already wrote. The column is NOT NULL and the
-- public page renders it, so affected rows fall back to the handle: already
-- public by definition, already the profile's address, and nothing anyone
-- has to be told about. The owner can set a real name in settings.
--
-- The handle itself is deliberately NOT touched. It may already have been
-- shared, and breaking a link somebody is holding to tidy up a name is the
-- wrong trade (decision of 05.09.2026, recorded on #36).
UPDATE profiles p
SET display_name = p.handle
FROM users u
WHERE u.id = p.user_id
  AND p.handle IS NOT NULL
  AND p.display_name = split_part(u.email, '@', 1);
