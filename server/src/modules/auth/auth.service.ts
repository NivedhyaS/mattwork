import { Role } from '@prisma/client';
import prisma from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { hashPassword, comparePassword } from '../../utils/password.utils';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.utils';
import { RegisterInput, LoginInput } from './auth.validator';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatar: string | null;
  };
  tokens: AuthTokens;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const hashedPassword = await hashPassword(input.password);
    const accessToken = signAccessToken({
      id: 'temp',
      email: input.email,
      name: input.name,
      role: input.role as Role,
    });

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: input.role as Role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    // Now generate proper tokens with real user id
    const newAccessToken = signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    // Create profile record based on role
    if (user.role === Role.CLIENT) {
      await prisma.client.create({ data: { userId: user.id } });
    } else if (user.role === Role.EDITOR) {
      await prisma.editor.create({ data: { userId: user.id } });
    }

    return {
      user,
      tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
        isActive: true,
        avatar: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Contact support.');
    }

    const isPasswordValid = await comparePassword(input.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const refreshToken = signRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    const { password: _pw, ...safeUser } = user;

    return {
      user: safeUser,
      tokens: { accessToken, refreshToken },
    };
  }

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async refreshTokens(token: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        refreshToken: true,
        isActive: true,
      },
    });

    if (!user || user.refreshToken !== token) {
      throw ApiError.unauthorized('Invalid or revoked refresh token');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    const newAccessToken = signAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatar: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: { id: true, company: true, phone: true, address: true },
        },
        editor: {
          select: { id: true, bio: true, skills: true, hourlyRate: true, availability: true },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();
