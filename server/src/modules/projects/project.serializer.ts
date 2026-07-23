import { Role } from '@prisma/client';
import { AuthUser } from '../../types/express';
import { getStandardizedProjectName, getProjectSlug } from '../../utils/project';

// Prisma's Decimal type is not exported as a named TypeScript symbol from @prisma/client.
// We use a structural duck-type that matches the shape we actually use at runtime.
type PrismaDecimal = { toFixed(n: number): string } | null;

type CommentAuthor = {
  id: string;
  name: string;
  role: string;
};

type RawComment = {
  id: string;
  content: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
};

/** The full project shape as returned from the DB (all fields present). */
export type RawProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  submissionDate: Date | null;
  budget: PrismaDecimal;
  clientPrice: PrismaDecimal;
  editorPrice: PrismaDecimal;
  tags: string[];
  notes: string | null;
  driveFolder: string | null;
  formLink: string | null;
  rawMaterialsFolder: string | null;
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
  comments?: RawComment[];
};

// ─── Per-role response shapes ─────────────────────────────────────────────────

/**
 * ADMIN — sees everything: clientPrice, editorPrice, computed profit,
 * full client and editor identity (including contact email), internal comments, and priority.
 */
export type AdminProjectView = Omit<RawProject, 'clientPrice' | 'editorPrice'> & {
  clientPrice: string | null;
  editorPrice: string | null;
  profit: string | null;
  projectNumber: string;
  standardName: string;
  standardSlug: string;
};

/**
 * CLIENT — sees clientPrice and budget, but editorPrice, profit, priority, all editor
 * identity fields, comments, driveFolder, and rawMaterialsFolder are completely absent.
 */
export type ClientProjectView = Omit<
  RawProject,
  | 'priority'
  | 'rawMaterialsFolder'
  | 'driveFolder'
  | 'editorPrice'
  | 'editorId'
  | 'editor'
  | 'comments'
  | 'clientPrice'
  | 'budget'
> & {
  clientPrice: string | null;
  budget: string | null;
  files?: any[];
  projectNumber: string;
  standardName: string;
  standardSlug: string;
};

/**
 * EDITOR — sees title, status, deadlines, drive links, and comments — but priority, clientPrice,
 * profit, budget, rawMaterialsFolder, and all client contact info (email, phone) are absent.
 */
export type EditorProjectView = Omit<
  RawProject,
  'priority' | 'rawMaterialsFolder' | 'clientPrice' | 'editorPrice' | 'budget' | 'client'
> & {
  client: {
    id: string;
    company: string | null;
    user: { id: string; name: string; avatar: string | null };
  };
  editorPrice: string | null;
  projectNumber: string;
  standardName: string;
  standardSlug: string;
};

// ─── Serializer ───────────────────────────────────────────────────────────────

function toDecimalString(v: PrismaDecimal): string | null {
  if (v == null) return null;
  return v.toFixed(2);
}

/** Strips fields from a raw project based on the authenticated user's role. */
export function serializeProject(
  raw: RawProject,
  requester: AuthUser,
  projectNumber: string
): AdminProjectView | ClientProjectView | EditorProjectView {
  const standardName = getStandardizedProjectName(raw.title, raw.createdAt, projectNumber);
  const standardSlug = getProjectSlug(raw.title, raw.createdAt, projectNumber);

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
      return {
        ...rest,
        clientPrice,
        editorPrice,
        profit,
        projectNumber,
        standardName,
        standardSlug
      } as AdminProjectView;
    }

    // ── CLIENT ────────────────────────────────────────────────────────────
    case Role.CLIENT: {
      const clientPrice = toDecimalString(raw.clientPrice);
      const budget = toDecimalString(raw.budget);

      // Omit priority, rawMaterialsFolder, driveFolder, editorPrice, editorId, editor, and comments
      const {
        priority: _pr,
        rawMaterialsFolder: _rmf,
        driveFolder: _df,
        editorPrice: _ep,
        editorId: _eid,
        editor: _editor,
        comments: _comments,
        clientPrice: _cp,
        budget: _b,
        files,
        ...rest
      } = raw;

      // Filter files to only include final deliverables (VIDEO, IMAGE, DOCUMENT, ARCHIVE) for clients
      const allowedFileTypes = ['VIDEO', 'IMAGE', 'DOCUMENT', 'ARCHIVE'];
      let safeFiles: any[] | undefined = undefined;
      if (Array.isArray(files)) {
        safeFiles = files.filter((file: any) => allowedFileTypes.includes(file.fileType));
      }

      return {
        ...rest,
        clientPrice,
        budget,
        projectNumber,
        standardName,
        standardSlug,
        ...(safeFiles !== undefined && { files: safeFiles }),
      } as ClientProjectView;
    }

    // ── EDITOR ────────────────────────────────────────────────────────────
    case Role.EDITOR: {
      const editorPrice = toDecimalString(raw.editorPrice);

      // Omit priority, rawMaterialsFolder, clientPrice, editorPrice, budget, client
      const {
        priority: _pr,
        rawMaterialsFolder: _rmf,
        clientPrice: _cp,
        editorPrice: _ep,
        budget: _b,
        client: _client,
        ...rest
      } = raw;

      return {
        ...rest,
        editorPrice,
        projectNumber,
        standardName,
        standardSlug
      } as EditorProjectView;
    }

    default:
      // Fallback: return the safe minimum (editor view is most restrictive)
      return serializeProject(raw, { ...requester, role: Role.EDITOR }, projectNumber);
  }
}

/** Serialize an array of raw projects with the same role filter. */
export function serializeProjects(
  raws: RawProject[],
  requester: AuthUser,
  projectNumbersMap: Map<string, string>
): ReturnType<typeof serializeProject>[] {
  return raws.map((r) => {
    const num = projectNumbersMap.get(r.id) || '000';
    return serializeProject(r, requester, num);
  });
}

