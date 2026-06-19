insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where email = 'tiago84@gmail.com'
on conflict (user_id, role) do nothing;