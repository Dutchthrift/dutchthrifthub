-- Fix table ownership for dutchthrift_user
-- Run this as postgres superuser on the server:
-- sudo -u postgres psql -d dutchthrift -f /path/to/fix_ownership.sql

-- Change ownership of all tables to dutchthrift_user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO dutchthrift_user';
        RAISE NOTICE 'Changed owner of table % to dutchthrift_user', r.tablename;
    END LOOP;
END $$;

-- Change ownership of all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public')
    LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO dutchthrift_user';
        RAISE NOTICE 'Changed owner of sequence % to dutchthrift_user', r.sequence_name;
    END LOOP;
END $$;

-- Change ownership of all types/enums
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')
    LOOP
        EXECUTE 'ALTER TYPE public.' || quote_ident(r.typname) || ' OWNER TO dutchthrift_user';
        RAISE NOTICE 'Changed owner of type % to dutchthrift_user', r.typname;
    END LOOP;
END $$;

-- Grant all privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dutchthrift_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dutchthrift_user;
GRANT ALL ON SCHEMA public TO dutchthrift_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dutchthrift_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dutchthrift_user;

-- Done!
SELECT 'Ownership fix complete!' as result;
