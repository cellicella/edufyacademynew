-- ==============================================================================
-- Edufy Academy - One-Time Administrator Role Setup
-- File: supabase/setup_admin.sql
-- ==============================================================================
-- INSTRUCTIONS FOR EXECUTION:
-- 1. Open your Supabase Project Dashboard: https://supabase.com/dashboard/project/<your-project-id>
-- 2. Click "SQL Editor" -> "New query".
-- 3. Replace 'cellicella0@gmail.com' on line 16 with your admin email if different.
-- 4. Click "Run".
-- ==============================================================================

DO $$
DECLARE
    v_admin_email TEXT := 'cellicella0@gmail.com'; -- <<< Set target admin email here
    v_user_id UUID;
BEGIN
    -- 1. Find user ID from auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(v_admin_email);

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % was not found in auth.users. Please create or register the user account first.', v_admin_email;
    END IF;

    -- 2. Assign admin role in public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        headline
    )
    VALUES (
        v_user_id,
        v_admin_email,
        'Platform Administrator',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
        'admin'::public.user_role_type,
        'Platform Administrator'
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin'::public.user_role_type,
        headline = 'Platform Administrator',
        updated_at = timezone('utc'::text, now());

    -- 3. Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin"')
    WHERE id = v_user_id;

    RAISE NOTICE 'SUCCESS: User % (ID %) successfully promoted to Administrator!', v_admin_email, v_user_id;
END $$;
