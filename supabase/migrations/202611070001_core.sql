-- LoanLens core. Run on a fresh Supabase project; all amounts are integer centavos.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check(length(display_name)<=80), created_at timestamptz not null default now()
);
create table public.loans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  lender text not null check (length(trim(lender)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','offer','active')),
  principal_centavos bigint check (principal_centavos between 0 and 100000000000),
  proceeds_centavos bigint check (proceeds_centavos between 0 and 100000000000),
  withheld_centavos bigint check (withheld_centavos between 0 and 100000000000),
  upfront_paid_centavos bigint check (upfront_paid_centavos between 0 and 100000000000),
  disbursement_date date check (disbursement_date between '1900-01-01' and '2199-12-31'),
  first_due_date date check (first_due_date between '1900-01-01' and '2199-12-31'),
  term_months int check (term_months between 1 and 600),
  frequency text not null default 'unknown' check (frequency in ('unknown','monthly','weekly','fortnightly','irregular')),
  notes text not null default '' check (length(notes)<=5000), created_at timestamptz not null default now(),
  unique (id,user_id)
);
create table public.loan_terms (
  loan_id uuid primary key, user_id uuid not null,
  interest_wording text not null default '' check(length(interest_wording)<=5000),
  rate numeric(7,4) check (rate between 0 and 100),
  rate_period text not null default 'unknown' check(rate_period in ('unknown','month','year','week','installment','whole-term')),
  calculation_method text not null default 'unknown' check(calculation_method in ('unknown','flat-add-on','reducing-balance','interest-free','other')),
  penalty_wording text not null default '' check(length(penalty_wording)<=5000),
  prepayment_terms text not null default '' check(length(prepayment_terms)<=5000),
  collateral text not null default 'unknown' check(collateral in ('unknown','yes','no')),
  guaranty text not null default 'unknown' check(guaranty in ('unknown','yes','no')),
  suretyship text not null default 'unknown' check(suretyship in ('unknown','yes','no')),
  security_notes text not null default '' check(length(security_notes)<=5000),
  schedule_complete boolean not null default false,
  unique(loan_id,user_id),
  foreign key (loan_id,user_id) references public.loans(id,user_id)
);
create table public.installments (
  id uuid primary key default gen_random_uuid(), loan_id uuid not null, user_id uuid not null,
  sequence int not null check(sequence between 1 and 360),
  due_date date not null check(due_date between '1900-01-01' and '2199-12-31'),
  amount_centavos bigint not null check(amount_centavos between 1 and 100000000000),
  unique(loan_id,sequence), unique(id,loan_id,user_id),
  foreign key(loan_id,user_id) references public.loans(id,user_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), loan_id uuid not null, user_id uuid not null,
  request_id uuid not null, request_payload jsonb not null, unique(user_id,request_id),
  paid_on date not null check(paid_on between '1900-01-01' and '2199-12-31'),
  amount_centavos bigint not null check(amount_centavos between 1 and 100000000000),
  reference text not null default '' check(length(reference)<=160), notes text not null default '' check(length(notes)<=5000),
  principal_centavos bigint check(principal_centavos>=0), interest_centavos bigint check(interest_centavos>=0), fees_centavos bigint check(fees_centavos>=0),
  voided_at timestamptz, void_reason text, created_at timestamptz not null default now(),
  check(coalesce(principal_centavos,0)+coalesce(interest_centavos,0)+coalesce(fees_centavos,0)<=amount_centavos),
  unique(id,loan_id,user_id), foreign key(loan_id,user_id) references public.loans(id,user_id)
);
create table public.payment_allocations (
  payment_id uuid not null, installment_id uuid not null, loan_id uuid not null, user_id uuid not null,
  amount_centavos bigint not null check(amount_centavos between 1 and 100000000000),
  primary key(payment_id,installment_id),
  foreign key(payment_id,loan_id,user_id) references public.payments(id,loan_id,user_id),
  foreign key(installment_id,loan_id,user_id) references public.installments(id,loan_id,user_id)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), loan_id uuid not null, user_id uuid not null,
  payment_id uuid, filename text not null check(length(filename) between 1 and 180), object_path text not null unique,
  mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes int not null check(size_bytes between 1 and 5242880), created_at timestamptz not null default now(),
  check(split_part(object_path,'/',1)=user_id::text and split_part(object_path,'/',2)=loan_id::text),
  foreign key(loan_id,user_id) references public.loans(id,user_id),
  foreign key(payment_id,loan_id,user_id) references public.payments(id,loan_id,user_id)
);
create table public.correction_history (
  id uuid primary key default gen_random_uuid(), loan_id uuid not null, user_id uuid not null,
  action text not null, reason text not null default '', before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now(),
  foreign key(loan_id,user_id) references public.loans(id,user_id)
);
create index loans_owner on public.loans(user_id);
create index installments_owner_due on public.installments(user_id,due_date);
create index payments_owner_date on public.payments(user_id,paid_on);
create index allocations_loan on public.payment_allocations(loan_id,installment_id);
create index documents_owner on public.documents(user_id,loan_id);
create index history_owner on public.correction_history(user_id,loan_id);

-- No direct writes to financial tables. Authenticated RPCs below are the mutation boundary.
do $$ declare t text; begin
  foreach t in array array['profiles','loans','loan_terms','installments','payments','payment_allocations','documents','correction_history'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = %I)',t,case when t='profiles' then 'id' else 'user_id' end);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
create policy profile_write on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
grant update(display_name) on public.profiles to authenticated;
create function public.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
revoke all on function public.create_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

-- Atomic create/update of drafts and offers, including their user-reviewed schedule.
create function public.save_offer(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); lid uuid; old_data jsonb; row_data jsonb; term jsonb:=payload->'terms'; i jsonb; n int:=0; begin
  if uid is null then raise exception 'Authentication required'; end if;
  if payload->>'status' not in ('draft','offer') or payload->>'status' is null then raise exception 'Invalid status'; end if;
  if jsonb_typeof(payload->'installments')<>'array' or jsonb_array_length(payload->'installments')>360 then raise exception 'Invalid schedule'; end if;
  lid:=(payload->>'id')::uuid;
  if lid is null then
    insert into public.loans(user_id,lender) values(uid,payload->>'lender') returning id into lid;
  else
    select to_jsonb(l) into old_data from public.loans l where id=lid and user_id=uid for update;
    if old_data is null then raise exception 'Record unavailable'; end if;
    if old_data->>'status'='active' then raise exception 'Active schedules and terms are frozen'; end if;
    old_data:=old_data || jsonb_build_object('terms',(select to_jsonb(t) from public.loan_terms t where loan_id=lid),'installments',(select jsonb_agg(to_jsonb(s)) from public.installments s where loan_id=lid));
  end if;
  update public.loans set lender=payload->>'lender', status=payload->>'status',
    principal_centavos=(payload->>'principal_centavos')::bigint, proceeds_centavos=(payload->>'proceeds_centavos')::bigint,
    withheld_centavos=(payload->>'withheld_centavos')::bigint, upfront_paid_centavos=(payload->>'upfront_paid_centavos')::bigint,
    disbursement_date=(payload->>'disbursement_date')::date,first_due_date=(payload->>'first_due_date')::date,
    term_months=(payload->>'term_months')::int,frequency=payload->>'frequency',notes=payload->>'notes'
    where id=lid;
  delete from public.loan_terms where loan_id=lid;
  insert into public.loan_terms(loan_id,user_id,interest_wording,rate,rate_period,calculation_method,penalty_wording,prepayment_terms,collateral,guaranty,suretyship,security_notes,schedule_complete)
    values(lid,uid,term->>'interest_wording',(term->>'rate')::numeric,term->>'rate_period',term->>'calculation_method',term->>'penalty_wording',term->>'prepayment_terms',term->>'collateral',term->>'guaranty',term->>'suretyship',term->>'security_notes',(term->>'schedule_complete')::boolean);
  delete from public.installments where loan_id=lid;
  for i in select value from jsonb_array_elements(payload->'installments') order by value->>'due_date' loop
    n:=n+1;
    if (i->>'due_date')::date < (payload->>'disbursement_date')::date then raise exception 'Installment precedes disbursement'; end if;
    insert into public.installments(loan_id,user_id,sequence,due_date,amount_centavos) values(lid,uid,n,(i->>'due_date')::date,(i->>'amount_centavos')::bigint);
  end loop;
  if (term->>'schedule_complete')::boolean and n=0 then raise exception 'Complete schedule needs installments'; end if;
  if n>0 and (payload->>'first_due_date')::date <> (select min(due_date) from public.installments where loan_id=lid) then raise exception 'First due date mismatch'; end if;
  select to_jsonb(l) into row_data from public.loans l where id=lid;
  insert into public.correction_history(loan_id,user_id,action,before_data,after_data) values(lid,uid,case when old_data is null then 'offer_created' else 'offer_updated' end,old_data,payload);
  return lid;
end $$;

create function public.activate_loan(lid uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.loans; begin
  select * into l from public.loans where id=lid and user_id=auth.uid() for update;
  if not found then raise exception 'Record unavailable'; end if;
  if l.status='active' then raise exception 'Already active'; end if;
  if l.principal_centavos is null or l.proceeds_centavos is null or l.disbursement_date is null then raise exception 'Principal, proceeds, and disbursement date are required'; end if;
  if not exists(select 1 from public.loan_terms where loan_id=lid and schedule_complete) or not exists(select 1 from public.installments where loan_id=lid) then raise exception 'Review and confirm a complete schedule first'; end if;
  update public.loans set status='active' where id=lid;
  insert into public.correction_history(loan_id,user_id,action,before_data,after_data) values(lid,auth.uid(),'loan_activated',to_jsonb(l),jsonb_build_object('status','active'));
end $$;

-- Serialize on the loan to prevent simultaneous payments exceeding installment capacity.
create function public.record_payment(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); lid uuid:=(payload->>'loan_id')::uuid; pid uuid; prior public.payments; a jsonb; inst public.installments; used bigint; total bigint:=0; amount bigint:=(payload->>'amount_centavos')::bigint; begin
  perform 1 from public.loans where id=lid and user_id=uid and status='active' for update;
  if not found then raise exception 'Active loan unavailable'; end if;
  select * into prior from public.payments where user_id=uid and request_id=(payload->>'request_id')::uuid;
  if found then
    if prior.request_payload=payload then return prior.id; end if;
    raise exception 'Request already used with different values; refresh before recording another payment';
  end if;
  if (payload->>'paid_on')::date > (now() at time zone 'Asia/Manila')::date then raise exception 'Payment date cannot be in the future'; end if;
  if (payload->>'paid_on')::date < (select disbursement_date from public.loans where id=lid) then raise exception 'Payment precedes disbursement'; end if;
  if jsonb_typeof(payload->'allocations')<>'array' or jsonb_array_length(payload->'allocations')>360 then raise exception 'Invalid allocations'; end if;
  insert into public.payments(loan_id,user_id,request_id,request_payload,paid_on,amount_centavos,reference,notes,principal_centavos,interest_centavos,fees_centavos)
    values(lid,uid,(payload->>'request_id')::uuid,payload,(payload->>'paid_on')::date,amount,payload->>'reference',payload->>'notes',(payload->>'principal_centavos')::bigint,(payload->>'interest_centavos')::bigint,(payload->>'fees_centavos')::bigint) returning id into pid;
  for a in select value from jsonb_array_elements(payload->'allocations') loop
    select * into inst from public.installments where id=(a->>'installment_id')::uuid and loan_id=lid and user_id=uid;
    if not found then raise exception 'Installment unavailable'; end if;
    select coalesce(sum(pa.amount_centavos),0) into used from public.payment_allocations pa join public.payments p on p.id=pa.payment_id where pa.installment_id=inst.id and p.voided_at is null;
    if used+(a->>'amount_centavos')::bigint > inst.amount_centavos then raise exception 'Application exceeds installment remainder'; end if;
    total:=total+(a->>'amount_centavos')::bigint;
    insert into public.payment_allocations(payment_id,installment_id,loan_id,user_id,amount_centavos) values(pid,inst.id,lid,uid,(a->>'amount_centavos')::bigint);
  end loop;
  if total>amount then raise exception 'Applications exceed payment'; end if;
  insert into public.correction_history(loan_id,user_id,action,after_data) values(lid,uid,'payment_recorded',payload || jsonb_build_object('payment_id',pid));
  return pid;
end $$;

-- Corrections preserve the original entry and allocations. A replacement is a new payment.
create function public.void_payment(pid uuid, reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; lid uuid; begin
  if length(trim(reason)) not between 3 and 1000 then raise exception 'Give a correction reason (3–1000 characters)'; end if;
  select loan_id into lid from public.payments where id=pid and user_id=auth.uid();
  perform 1 from public.loans where id=lid and user_id=auth.uid() for update;
  if not found then raise exception 'Record unavailable'; end if;
  select * into p from public.payments where id=pid and user_id=auth.uid() and voided_at is null for update;
  if not found then raise exception 'Payment unavailable or already voided'; end if;
  update public.payments set voided_at=now(),void_reason=reason where id=pid;
  insert into public.correction_history(loan_id,user_id,action,reason,before_data,after_data) values(lid,auth.uid(),'payment_voided',reason,to_jsonb(p),jsonb_build_object('voided',true));
end $$;

create function public.register_document(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare did uuid; begin
  if not exists(select 1 from public.loans where id=(payload->>'loan_id')::uuid and user_id=auth.uid()) then raise exception 'Record unavailable'; end if;
  if not exists(select 1 from storage.objects where bucket_id='loan-documents' and name=payload->>'object_path') then raise exception 'Upload unavailable'; end if;
  insert into public.documents(loan_id,user_id,payment_id,filename,object_path,mime_type,size_bytes)
  values((payload->>'loan_id')::uuid,auth.uid(),(payload->>'payment_id')::uuid,payload->>'filename',payload->>'object_path',payload->>'mime_type',(payload->>'size_bytes')::int) returning id into did;
  return did;
end $$;

do $$ declare signature text; begin
 foreach signature in array array['save_offer(jsonb)','activate_loan(uuid)','record_payment(jsonb)','void_payment(uuid,text)','register_document(jsonb)'] loop
   execute 'revoke all on function public.' || signature || ' from public, anon';
   execute 'grant execute on function public.' || signature || ' to authenticated';
 end loop;
end $$;

-- No public financial files. Owner path also includes an owned loan ID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('loan-documents','loan-documents',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy loan_documents_read on storage.objects for select to authenticated using (
  bucket_id='loan-documents' and split_part(name,'/',1)=(select auth.uid())::text
  and exists(select 1 from public.loans l where l.id::text=split_part(name,'/',2) and l.user_id=(select auth.uid()))
);
create policy loan_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id='loan-documents' and split_part(name,'/',1)=(select auth.uid())::text
  and exists(select 1 from public.loans l where l.id::text=split_part(name,'/',2) and l.user_id=(select auth.uid()))
);
-- Only orphan cleanup; registered evidence cannot be overwritten or deleted by the app.
create policy loan_documents_cleanup on storage.objects for delete to authenticated using (
  bucket_id='loan-documents' and split_part(name,'/',1)=(select auth.uid())::text
  and not exists(select 1 from public.documents d where d.object_path=name and d.user_id=(select auth.uid()))
);
