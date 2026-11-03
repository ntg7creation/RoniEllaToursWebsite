-- Durable private email status. Only the backend may claim/send/finish jobs.
create table public.callback_email_jobs (
  submission_id uuid primary key references public.callback_requests(submission_id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  provider_id text,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.callback_email_jobs enable row level security;
revoke all on public.callback_email_jobs from public,anon,authenticated,service_role;
grant select,insert,update on public.callback_email_jobs to service_role;

create function public.queue_callback_email() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.callback_email_jobs(submission_id) values(new.submission_id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_callback_email() from public,anon,authenticated;
grant execute on function public.queue_callback_email() to service_role;
create trigger queue_callback_email_after_insert after insert on public.callback_requests for each row execute function public.queue_callback_email();

create function public.claim_callback_email(requested_submission uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.callback_email_jobs; result jsonb;
begin
  -- An expired SMTP lease may already have sent DATA. Require manual review.
  update public.callback_email_jobs set state='failed',error_code='delivery_unknown'
  where state='sending' and lease_until<now();
  update public.callback_email_jobs set state='failed',error_code='review_required'
  where state in ('pending','sending') and (attempts>=5 or first_attempt_at<now()-interval '23 hours')
    and (lease_until is null or lease_until<now());
  select * into job from public.callback_email_jobs
  where (requested_submission is null or submission_id=requested_submission)
    and state in ('pending','sending') and available_at<=now()
    and (lease_until is null or lease_until<now())
  order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.callback_email_jobs set state='sending',attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  where submission_id=job.submission_id returning * into job;
  select jsonb_build_object('submissionId',r.submission_id,'leaseToken',job.lease_token,'name',r.full_name,
    'phone',r.phone_e164,'country',r.phone_country,'email',r.email,'destinationLabel',r.destination_label,
    'sourcePath',r.source_path,'createdAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) into result
  from public.callback_requests r where r.submission_id=job.submission_id;
  return result;
end;
$$;
create function public.finish_callback_email(requested_submission uuid,lease uuid,provider_id text default null,error_code text default null) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if provider_id is not null and (length(provider_id)>256 or error_code is not null) then raise exception 'invalid_email_result'; end if;
  if error_code is not null and error_code not in ('network','provider_configuration','provider_error','delivery_unknown','notification_state') then raise exception 'invalid_email_result'; end if;
  update public.callback_email_jobs j set
    state=case when finish_callback_email.provider_id is not null then 'sent' when j.attempts>=5 or finish_callback_email.error_code='delivery_unknown' then 'failed' else 'pending' end,
    provider_id=finish_callback_email.provider_id,error_code=finish_callback_email.error_code,
    sent_at=case when finish_callback_email.provider_id is not null then now() else null end,
    available_at=now()+interval '5 minutes',lease_until=null,lease_token=null
  where j.submission_id=requested_submission and j.lease_token=lease and j.state='sending';
end;
$$;
revoke all on function public.claim_callback_email(uuid),public.finish_callback_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_callback_email(uuid),public.finish_callback_email(uuid,uuid,text,text) to service_role;
comment on table public.callback_requests is 'Private callback inbox. Backend can notify the business through Gmail when server-only App Password is configured. numbering-plan does not mean SMS verification.';
