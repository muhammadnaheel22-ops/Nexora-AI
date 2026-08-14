process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/nexora_rebuilt";
process.env.JWT_SECRET ||= "test-secret-that-is-longer-than-thirty-two-characters";
process.env.CORS_ORIGIN ||= "http://localhost:5173";
process.env.OPENROUTER_API_KEY = "";
