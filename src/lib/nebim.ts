import mssql from "mssql";

const config: mssql.config = {
  server: process.env.NEBIM_HOST || "",
  port: parseInt(process.env.NEBIM_PORT || "5433"),
  database: process.env.NEBIM_DATABASE || "GHISA_V3",
  user: process.env.NEBIM_USER || "",
  password: process.env.NEBIM_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 60000,
};

let pool: mssql.ConnectionPool | null = null;

export async function getPool(): Promise<mssql.ConnectionPool> {
  if (!pool || !pool.connected) {
    pool = await new mssql.ConnectionPool(config).connect();
  }
  return pool;
}

export { mssql };
