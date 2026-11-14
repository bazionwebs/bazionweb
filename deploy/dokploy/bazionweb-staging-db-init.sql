\getenv app_password BAZIONWEB_APP_PASSWORD
\getenv migrator_password BAZIONWEB_MIGRATOR_PASSWORD

CREATE ROLE bazionweb_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE bazionweb_app LOGIN PASSWORD :'app_password';
ALTER DATABASE bazionweb_staging OWNER TO bazionweb_migrator;

\connect bazionweb_staging

ALTER SCHEMA public OWNER TO bazionweb_migrator;
GRANT CONNECT ON DATABASE bazionweb_staging TO bazionweb_app;
GRANT USAGE ON SCHEMA public TO bazionweb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bazionweb_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bazionweb_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bazionweb_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bazionweb_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bazionweb_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bazionweb_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bazionweb_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO bazionweb_app;