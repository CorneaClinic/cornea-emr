process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://cornea:test@127.0.0.1:5432/cornea_emr_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long!!';
process.env.SECRETS_ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || 'test-encryption-key-32-chars-min!!!!';
process.env.CORS_ORIGIN = 'http://127.0.0.1:8080';
