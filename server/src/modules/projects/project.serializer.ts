import { Role } from '@prisma/client';
import { AuthUser } from '../../types/express';

// Prisma's Decimal type is not exported as a named TypeScript symbol from @prisma/client.
// We use a structural duck-type that matches the shape we actually use at runtime.
type PrismaDecimal = { toFixed(n: number): string } | null;


/** The full project shape as returned from the DB (all fields present). */
export type RawProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  budget: PrismaDecimal;
  clientPrice: PrismaDecimal;
  editorPrice: PrismaDecimal;
  tags: string[];
  notes: string | null;
  driveFolder: string | null;
  formLink: string | null;
  clientId: string;
  editorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string;
    company: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    };
  };
  editor: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
    };
  } | null;
  _count?: { files: number; invoices: number };
  // Optional extra relations on detail endpoint
  files?: unknown[];
  invoices?: unknown[];
};

// ─── Per-role response shapes ─────────────────────────────────────────────────

/**
 * ADMIN — sees everything: clientPrice, editorPrice, computed profit,
 * full client and editor identity (including contact email).
 */
export type AdminProjectView = Omit<RawProject, 'clientPrice' | 'editorPrice'> & {
  clientPrice: string | null;
  editorPrice: string | null;
  profit: string | null;
};

/**
 * CLIENT — sees clientPrice, but editorPrice, profit, and all editor
 * identity fields (name, email, avatar, id) are completely absent.
 */
export type ClientProjectView = Omit<
  RawProject,
  'editorPrice' | 'editorId' | 'editor'
> & {
  clientPrice: string | null;
};

/**
 * EDITOR — sees title, status, deadlines, drive links — but clientPrice,
 * editorPrice, profit, and all client contact info (email, phone) are absent.
 */
export type EditorProjectView = Omit<
  RawProject,
  'clientPrice' | 'editorPrice' | 'client'
> & {
  client: {
    id: string;
    company: string | null;
    // user.name visible but email EXCLUDED
    user: { id: string; name: string; avatar: string | null };
  };
};

// ─── Serializer ───────────────────────────────────────────────────────────────

function toDecimalString(v: PrismaDecimal): string | null {
  if (v == null) return null;
  return v.toFixed(2);
}

/** Strips fields from a raw project based on the authenticated user's role. */
export function serializeProject(
  raw: RawProject,
  requester: AuthUser
): AdminProjectView | ClientProjectView | EditorProjectView {
  switch (requester.role) {
    // ── ADMIN ──────────────────────────────────────────────────────────────
    case Role.ADMIN: {
      const clientPrice = toDecimalString(raw.clientPrice);
      const editorPrice = toDecimalString(raw.editorPrice);

      // Compute profit only when both values are present
      let profit: string | null = null;
      if (raw.clientPrice != null && raw.editorPrice != null) {
        profit = (
          Number(raw.clientPrice) - Number(raw.editorPrice)
        ).toFixed(2);
      }

      const { clientPrice: _cp, editorPrice: _ep, ...rest } = raw;
      return { ...rest, clientPrice, editorPrice, profit } as AdminProjectView;
    }

    // ── CLIENT ────────────────────────────────────────────────────────────
    case Role.CLIENT: {
      const clientPrice = toDecimalString(raw.clientPrice);

      // Omit editorPrice, profit, all editor identity (editorId + editor relation)
      const {
        clientPrice: _cp,
        editorPrice: _ep, // excluded
        editorId: _eid,   // excluded — prevents client discovering who their editor is by ID
        editor: _editor,  // excluded — entire editor sub-object
        ...rest
      } = raw;

      return { ...rest, clientPrice } as ClientProjectView;
    }

    // ── EDITOR ────────────────────────────────────────────────────────────
    case Role.EDITOR: {
      // Omit clientPrice, editorPrice, profit, client contact email
      const {
        clientPrice: _cp,  // excluded
        editorPrice: _ep,  // excluded — editors must not see their own rate from this API
        client,
        ...rest
      } = raw;

      // Keep client company + name + avatar; exclude email entirely
      const safeClient = {
        id: client.id,
        company: client.company,
        user: {
          id: client.user.id,
          name: client.user.name,
          avatar: client.user.avatar,
          // email is intentionally absent — not null, not undefined, just not here
        },
      };

      return { ...rest, client: safeClient } as EditorProjectView;
    }

    default:
      // Fallback: return the safe minimum (editor view is most restrictive)
      return serializeProject(raw, { ...requester, role: Role.EDITOR });
  }
}

/** Serialize an array of raw projects with the same role filter. */
export function serializeProjects(
  raws: RawProject[],
  requester: AuthUser
): ReturnType<typeof serializeProject>[] {
  return raws.map((r) => serializeProject(r, requester));
}
