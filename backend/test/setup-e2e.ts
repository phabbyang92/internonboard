// This file runs before AppModule is imported, so ConfigModule sees only
// isolated E2E values and never connects to the development database.
process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
process.env.MONGODB_URI =
  process.env.E2E_MONGODB_URI ??
  'mongodb://127.0.0.1:27017/intern_onboarding_e2e';
process.env.JWT_SECRET = 'e2e-only-jwt-secret-with-sufficient-length';
process.env.FILE_STORAGE_DRIVER = 'local';
process.env.UPLOAD_DIR = `/tmp/intern-onboarding-e2e-${process.pid}`;
