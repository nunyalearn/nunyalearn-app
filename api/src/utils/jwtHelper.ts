import jwt from "jsonwebtoken";

const getUserSecret = (): jwt.Secret => {
  const secret = process.env.JWT_SECRET_USER;
  if (!secret) {
    throw new Error("JWT_SECRET_USER is not defined in environment variables");
  }
  return secret;
};

export const signUserToken = (
  payload: jwt.JwtPayload,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d",
): string => {
  const options: jwt.SignOptions = { expiresIn };
  return jwt.sign(payload, getUserSecret(), options);
};

export const verifyUserToken = <T>(token: string): T => {
  return jwt.verify(token, getUserSecret()) as T;
};
