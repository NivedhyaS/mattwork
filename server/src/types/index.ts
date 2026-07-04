import { Role } from '@prisma/client';

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── Invoice Item ─────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponseShape<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
  meta?: Record<string, unknown>;
}
