import bcrypt from 'bcrypt';
import { env } from '../config/env';

export const hashPassword = async (plaintext: string): Promise<string> => {
  return bcrypt.hash(plaintext, env.BCRYPT_ROUNDS);
};

export const comparePassword = async (
  plaintext: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plaintext, hashed);
};
