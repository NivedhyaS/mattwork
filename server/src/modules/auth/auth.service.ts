import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { hashPassword, comparePassword } from '../../utils/password.utils';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.utils';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from './auth.validator';

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

interface ForgotPasswordResult {
  /** Always the same generic message to prevent email enumeration */
  message: string;
  /** Only included in development — the raw, un-hashed reset link */
  devResetLink?: string;
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

  /**
   * Generates a password reset token and stores its SHA-256 hash in the database.
   *
   * Security considerations:
   * - Always returns the same generic message regardless of whether the email exists
   *   (prevents email enumeration attacks).
   * - Stores only the hashed token in the database, so a DB leak cannot be used
   *   to directly reset passwords.
   * - Raw token is only exposed in the API response when NODE_ENV === 'development'.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
    const genericMessage =
      'If that email exists in our system, a password reset link has been sent.';

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, isActive: true },
    });

    // Always return generic response — never reveal whether email exists
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    // Generate a cryptographically secure 32-byte random token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store only the SHA-256 hash of the token in the database
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expiresAt,
      },
    });

    // Construct the full reset URL
    const clientBaseUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const resetLink = `${clientBaseUrl}/reset-password?token=${rawToken}`;

    // Always log to server terminal for audit trail
    console.log(`\n🔑 [Password Reset] User: ${user.email}`);
    console.log(`   Reset Link (expires in 1 hour): ${resetLink}\n`);

    // Only expose raw link in development (server-side guard)
    if (env.NODE_ENV === 'development') {
      return { message: genericMessage, devResetLink: resetLink };
    }

    return { message: genericMessage };
  }

  /**
   * Validates the reset token and updates the password atomically in a single transaction.
   *
   * Security considerations:
   * - Looks up the user by the SHA-256 hash of the incoming token (never plain-text comparison).
   * - Password update AND token clearance happen in a single Prisma transaction, preventing
   *   token reuse if any step fails.
   * - Also invalidates the refresh token to force re-login.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    // Hash the incoming token to match against the stored hashed value
    const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');

    // Find user with matching non-expired token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      throw ApiError.badRequest(
        'Password reset token is invalid or has expired. Please request a new reset link.'
      );
    }

    const hashedPassword = await hashPassword(input.password);

    // Atomically update password and clear the token in a single transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          // Also invalidate any existing refresh tokens to force re-login
          refreshToken: null,
        },
      }),
    ]);
  }
}

export const authService = new AuthService();
