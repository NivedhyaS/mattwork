import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, RefreshTokenPayload } from '../types';
import { ApiError } from './ApiError';

export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const signRefreshToken = (userId: string): string => {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    id: userId,
    type: 'refresh',
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token has expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Refresh token has expired');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }
};

export const extractTokenFromHeader = (authHeader?: string): string => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided');
  }
  return authHeader.slice(7);
};
