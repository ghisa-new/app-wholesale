import { SignJWT, jwtVerify } from "jose";
import { queryOne } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

const COOKIE_NAME = "wholesale_token";

export interface UserPayload {
  id: number;
  email: string;
  name: string;
  company: string;
  phone: string;
  role: string;
}

export async function signToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserPayload | null> {
  // This is for server components / route handlers that need cookie access
  // For route handlers, use getUserFromRequest instead
  return null;
}

export async function getUserFromRequest(
  request: Request
): Promise<UserPayload | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

export function getUserById(id: number) {
  return queryOne<{
    id: number;
    email: string;
    name: string;
    company: string;
    phone: string;
    role: string;
  }>(
    "SELECT id, email, name, company, phone, role FROM users WHERE id = ?",
    [id]
  );
}

export { COOKIE_NAME };
