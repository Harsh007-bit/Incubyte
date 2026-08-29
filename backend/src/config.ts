export const config = {
  port: Number(process.env.PORT ?? 8000),
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    "postgresql://acme:acme@localhost:5432/acme",
  tz: process.env.APP_TZ ?? "Asia/Kolkata",
};
