import { configureE2eEnvironment } from './e2e-environment';

// setupFiles runs before AppModule is imported. Invalid targets are rejected
// before NestJS can connect to MongoDB or initialize a storage provider.
configureE2eEnvironment();
