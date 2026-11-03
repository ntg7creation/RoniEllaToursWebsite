-- Keep v1 accepted for a rolling deployment; new backend records the v2 disclosure.
create or replace function public.create_callback_request(payload jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  -- Hold a transaction lock so retries of one request cannot consume multiple slots.
  perform pg_advisory_xact_lock(hashtextextended(payload->>'submissionId',0));
  if exists(select 1 from public.callback_requests where submission_id=(payload->>'submissionId')::uuid) then return; end if;
  if payload->'privacyAccepted' is distinct from 'true'::jsonb or payload->>'privacyVersion' not in ('2026-11-03-callback-v1','2026-11-03-callback-v2') or payload->>'clientKey' !~ '^[a-f0-9]{64}$' then
    raise exception 'callback_invalid';
  end if;
  delete from public.callback_rate_limits where expires_at<now()-interval '1 day';
  insert into public.callback_rate_limits(client_key,count,expires_at)
  values(payload->>'clientKey',1,now()+interval '15 minutes')
  on conflict(client_key) do update set
    count=case when callback_rate_limits.expires_at<=now() then 1 else callback_rate_limits.count+1 end,
    expires_at=case when callback_rate_limits.expires_at<=now() then now()+interval '15 minutes' else callback_rate_limits.expires_at end
  where callback_rate_limits.expires_at<=now() or callback_rate_limits.count<5;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'callback_rate_limited'; end if;
  if payload->>'destination'<>'undecided' and not exists(select 1 from public.content_pages
    where id=payload->>'destination' and published and page_type='destinationArchive') then raise exception 'callback_invalid'; end if;
  insert into public.callback_requests(submission_id,full_name,phone_e164,phone_country,email,destination_page_id,destination_label,source_path,privacy_version)
  values((payload->>'submissionId')::uuid,payload->>'name',payload->>'phone',payload->>'country',nullif(payload->>'email',''),
    nullif(payload->>'destination','undecided'),payload->>'destinationLabel',payload->>'sourcePath',payload->>'privacyVersion');
end;
$$;
revoke all on function public.create_callback_request(jsonb) from public,anon,authenticated;
grant execute on function public.create_callback_request(jsonb) to service_role;

update public.content_blocks set text='בטופס הבקשה לשיחה חוזרת אנו מבקשים שם, מספר טלפון, יעד שמעניין אתכם ואישור למדיניות זו. כתובת דוא״ל היא שדה רשות. הפרטים נמסרים מרצונכם ונשמרים במערכת הפניות של העסק ב־Supabase, לצורך חזרה אליכם ומענה לפנייה. פרטי הפנייה נשלחים גם כהודעת דוא״ל לתיבת העסק באמצעות ספק הדוא״ל Gmail של Google, כדי שהצוות יוכל לטפל בפנייה. לצורך תיעוד ההסכמה נשמרים גם מועד האישור, גרסת המדיניות והעמוד שממנו נשלחה הבקשה. נשמר מזהה טכני למניעת שימוש לרעה בטופס. הגישה לפניות מוגבלת לצוות המורשה. שליחת הטופס אינה הרשמה לדיוור שיווקי. לבקשות לעיון, תיקון או מחיקת פרטים אפשר לפנות אלינו בכתובת roniellatours@gmail.com. פנייה בוואטסאפ או ביקור בפייסבוק וב־YouTube כפופים גם למדיניות הפרטיות של אותן פלטפורמות.' where page_id='page-2e63b934-ac47-4c06-9869-8a08048796bc' and text='בטופס הבקשה לשיחה חוזרת אנו מבקשים שם, מספר טלפון, יעד שמעניין אתכם ואישור למדיניות זו. כתובת דוא״ל היא שדה רשות. הפרטים נמסרים מרצונכם ונשמרים במערכת הפניות של העסק ב־Supabase, לצורך חזרה אליכם ומענה לפנייה. לצורך תיעוד ההסכמה נשמרים גם מועד האישור, גרסת המדיניות והעמוד שממנו נשלחה הבקשה. נשמר מזהה טכני למניעת שימוש לרעה בטופס. הגישה לפניות מוגבלת לצוות המורשה. שליחת הטופס אינה הרשמה לדיוור שיווקי. לבקשות לעיון, תיקון או מחיקת פרטים אפשר לפנות אלינו בכתובת roniellatours@gmail.com. פנייה בוואטסאפ או ביקור בפייסבוק וב־YouTube כפופים גם למדיניות הפרטיות של אותן פלטפורמות.';
