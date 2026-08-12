process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:test@127.0.0.1:3306/nexora_test";
process.env.JWT_SECRET ||= "test-secret-that-is-definitely-longer-than-thirty-two-characters";
process.env.AI_API_KEY ||= "";
process.env.CORS_ORIGIN ||= "http://localhost:5173";
