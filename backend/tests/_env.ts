// Load this FIRST in every test file (`import './_env'`) so that
// process.env is populated before tsx evaluates any other imports.
// ESM import hoisting means non-import statements at the top of a file
// run AFTER all of its imports — putting env setup in its own module
// guarantees it runs before any src/* module is loaded.
process.env.NODE_ENV ??= 'test';
process.env.DB_PATH ??= ':memory:';
process.env.JWT_SECRET ??= 'test-jwt-secret-test-jwt-secret-test-jwt-secret';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.LOG_LEVEL ??= 'error';
process.env.ADMIN_EMAIL ??= 'admin@test.local';
process.env.ADMIN_PASSWORD ??= 'testpassword123';
process.env.UPLOADS_DIR ??= `${process.cwd()}/.test-uploads`;
process.env.CORS_ORIGIN ??= '*';
process.env.PUBLIC_URL ??= 'http://localhost:0';
process.env.BCRYPT_ROUNDS ??= '4';
process.env.TZ ??= 'UTC';
