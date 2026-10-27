-- ==============================================================================
-- Edufy Academy - Supabase Authentication & Profile Trigger Fix
-- File: supabase/fix_auth_trigger.sql
-- ==============================================================================
-- INSTRUCTIONS FOR EXECUTION:
-- 1. Open your Supabase Project Dashboard: https://supabase.com/dashboard/project/<your-project-id>
-- 2. Click on "SQL Editor" in the left navigation sidebar.
-- 3. Click "New query", paste the contents of this file, and click "Run".
--
-- WHAT THIS FIXES:
-- 1. Sets "SET search_path = public, auth" on the handle_new_user() trigger function
--    so PostgreSQL can resolve the "public.user_role_type" enum properly.
-- 2. Adds exception handling so an error during profile creation never crashes
--    auth.users signup with "500 Database error saving new user".
-- 3. Adds an INSERT policy to public.profiles so authenticated users can insert
--    or repair their own profile if needed.
-- 4. Ensures all user roles (student, instructor, admin) map correctly from signup metadata.
-- ==============================================================================

BEGIN;

-- 1. Ensure user_role_type enum exists in public schema
DO $$ BEGIN
    CREATE TYPE public.user_role_type AS ENUM ('student', 'instructor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the robust, schema-safe trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role public.user_role_type;
    v_full_name TEXT;
    v_avatar TEXT;
BEGIN
    -- Parse role from user metadata safely
    CASE LOWER(COALESCE(new.raw_user_meta_data->>'role', 'student'))
        WHEN 'instructor' THEN v_role := 'instructor'::public.user_role_type;
        WHEN 'admin' THEN v_role := 'admin'::public.user_role_type;
        ELSE v_role := 'student'::public.user_role_type;
    END CASE;

    -- Parse full name
    v_full_name := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
        split_part(new.email, '@', 1)
    );

    -- Default avatar URL
    v_avatar := COALESCE(
        NULLIF(TRIM(new.raw_user_meta_data->>'avatar_url'), ''),
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'
    );

    -- Insert or update profile
    BEGIN
        INSERT INTO public.profiles (
            id,
            email,
            full_name,
            avatar_url,
            role,
            headline,
            bio
        )
        VALUES (
            new.id,
            new.email,
            v_full_name,
            v_avatar,
            v_role,
            CASE v_role
                WHEN 'instructor' THEN 'Lead Instructor at Edufy Academy'
                WHEN 'admin' THEN 'Platform Administrator'
                ELSE 'Edufy Learner'
            END,
            ''
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
            role = CASE 
                WHEN public.profiles.role = 'admin' THEN public.profiles.role 
                ELSE EXCLUDED.role 
            END;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log warning but never abort the auth.users signup transaction
            RAISE WARNING 'handle_new_user profile creation error for user %: %', new.id, SQLERRM;
    END;

    RETURN new;
END;
$$;

-- 3. Re-attach trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Add INSERT policy for profiles so authenticated users can create/upsert their profile
DO $$ BEGIN
    CREATE POLICY "Users can insert their own profile"
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMIT;
