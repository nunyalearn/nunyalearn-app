import jwt from "jsonwebtoken";

const getEnvOrThrow = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`);
  }
  return value;
};

const ACCESS_SECRET = (): jwt.Secret => getEnvOrThrow("JWT_SECRET_USER");
const REFRESH_SECRET = (): jwt.Secret => getEnvOrThrow("JWT_SECRET_REFRESH");

type SignExpiry = Exclude<jwt.SignOptions["expiresIn"], undefined>;

const accessExpiryString = process.env.ACCESS_TOKEN_EXPIRY ?? "15m";
const refreshExpiryString = process.env.REFRESH_TOKEN_EXPIRY ?? "7d";

const toSignExpiry = (value: string): SignExpiry => value as SignExpiry;

export const ACCESS_TOKEN_EXPIRY = accessExpiryString;
export const REFRESH_TOKEN_EXPIRY = refreshExpiryString;

const expiryStringToMs = (value: string): number => {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(`Invalid expiry format: ${value}`);
  }

  const [, amountStr, unitChar] = match;
  if (!amountStr || !unitChar) {
    throw new Error(`Invalid expiry format: ${value}`);
  }
  const amount = Number(amountStr);
  const unit = unitChar.toLowerCase();

  const unitMap: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const multiplier = unitMap[unit];
  if (!multiplier) {
    throw new Error(`Unsupported expiry unit: ${unit}`);
  }

  return amount * multiplier;
};

const refreshExpiryMs = expiryStringToMs(REFRESH_TOKEN_EXPIRY);

export const getRefreshExpiryDate = (): Date => {
  return new Date(Date.now() + refreshExpiryMs);
};

export const signAccessToken = (payload: jwt.JwtPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: toSignExpiry(ACCESS_TOKEN_EXPIRY),
  };
  return jwt.sign(payload, ACCESS_SECRET(), options);
};

export const signRefreshToken = (payload: jwt.JwtPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: toSignExpiry(REFRESH_TOKEN_EXPIRY),
  };
  return jwt.sign(payload, REFRESH_SECRET(), options);
};

export const verifyToken = <T>(token: string, type: "access" | "refresh" = "access"): T => {
  const secret = type === "refresh" ? REFRESH_SECRET() : ACCESS_SECRET();
  return jwt.verify(token, secret) as T;
};
