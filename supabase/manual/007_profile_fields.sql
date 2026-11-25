-- ============================================================================
-- 007 · Client profile fields: city/province, consultation language, preferred contact
--       method and time. (profiles.preferred_language already exists, but its check constraint
--       only allows 'en' | 'fil': it is the interface language, kept for the later language
--       feature, so consultation language gets its own column.)
--
-- App code: src/app/actions/profileExtrasActions.ts. Lawyers see these only for
-- clients they have a consultation with (checked on the server).
-- ============================================================================

alter table public.profiles
  add column if not exists city_province         text,
  add column if not exists consultation_language text,
  add column if not exists contact_method        text,
  add column if not exists contact_time          text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_contact_method_check') then
    alter table public.profiles add constraint profiles_contact_method_check
      check (contact_method is null or contact_method in ('messages', 'email', 'phone_call', 'sms'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_contact_time_check') then
    alter table public.profiles add constraint profiles_contact_time_check
      check (contact_time is null or contact_time in ('morning', 'afternoon', 'evening', 'anytime'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_consultation_language_check') then
    alter table public.profiles add constraint profiles_consultation_language_check
      check (consultation_language is null or consultation_language in
        ('English', 'Filipino', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Waray', 'Kapampangan', 'Bikolano'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_city_province_length') then
    alter table public.profiles add constraint profiles_city_province_length
      check (city_province is null or char_length(city_province) <= 120);
  end if;
end $$;

-- Check
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('city_province', 'consultation_language', 'contact_method', 'contact_time');
