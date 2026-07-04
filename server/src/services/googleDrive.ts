import { google, drive_v3 } from 'googleapis';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { DriveProjectFolder, SetupProjectFolderParams } from './googleDrive.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/** Sub-folders created inside every video-title folder */
const SUBFOLDERS = ['Assets', 'Working Files', 'Final Deliverables'] as const;

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === retries;
      const retryable =
        err?.code === 500 ||
        err?.code === 503 ||
        err?.status === 429 ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('socket hang up');

      if (isLast || !retryable) {
        logger.error(
          `[GoogleDriveService] "${label}" failed after ${attempt} attempt(s): ${err?.message}`
        );
        throw err;
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn(
        `[GoogleDriveService] "${label}" attempt ${attempt} failed — retrying in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // TypeScript needs this; the loop above always returns or throws.
  throw new Error(`withRetry: unreachable`);
}

// ─── Core folder helpers ──────────────────────────────────────────────────────

/**
 * Finds an existing folder by name inside a given parent, or creates it if
 * it doesn't exist.  All operations are wrapped in `withRetry`.
 */
async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Untitled';

  return withRetry(`findOrCreateFolder("${safeName}")`, async () => {
    // Search for an existing non-trashed folder with this name under the parent
    const query = [
      `mimeType = '${FOLDER_MIME}'`,
      `name = '${safeName.replace(/'/g, "\\'")}'`,
      `'${parentId}' in parents`,
      `trashed = false`,
    ].join(' and ');

    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1,
    });

    const existing = searchRes.data.files?.[0];
    if (existing?.id) {
      logger.info(
        `[GoogleDriveService] Reusing existing folder "${safeName}" (id=${existing.id})`
      );
      return existing.id;
    }

    // Create the folder
    const createRes = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: FOLDER_MIME,
        parents: [parentId],
      },
      fields: 'id',
    });

    const newId = createRes.data.id!;
    logger.info(
      `[GoogleDriveService] Created folder "${safeName}" (id=${newId}) inside parent ${parentId}`
    );
    return newId;
  });
}

/**
 * Creates a Drive shortcut pointing to an external URL inside the given folder.
 * If a shortcut with the same name already exists it is reused.
 */
async function createShortcut(
  drive: drive_v3.Drive,
  name: string,
  targetUrl: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Link';

  return withRetry(`createShortcut("${safeName}")`, async () => {
    // Check if a shortcut already exists
    const query = [
      `mimeType = '${SHORTCUT_MIME}'`,
      `name = '${safeName.replace(/'/g, "\\'")}'`,
      `'${parentId}' in parents`,
      `trashed = false`,
    ].join(' and ');

    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1,
    });

    const existing = searchRes.data.files?.[0];
    if (existing?.id) {
      logger.info(
        `[GoogleDriveService] Reusing existing shortcut "${safeName}" (id=${existing.id})`
      );
      return existing.id;
    }

    // Create a new shortcut file
    const createRes = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: SHORTCUT_MIME,
        parents: [parentId],
        shortcutDetails: {
          targetId: targetUrl, // Drive accepts URLs for shortcut targets
        } as any,
      },
      fields: 'id',
    });

    const newId = createRes.data.id!;
    logger.info(
      `[GoogleDriveService] Created shortcut "${safeName}" → ${targetUrl} (id=${newId})`
    );
    return newId;
  });
}

// ─── Service class ────────────────────────────────────────────────────────────

export class GoogleDriveService {
  /**
   * Returns an authenticated Google Drive v3 client when real credentials are
   * available and `GOOGLE_DRIVE_ENABLED=true`, or `null` for simulation mode.
   */
  private initDriveClient(): drive_v3.Drive | null {
    if (!env.GOOGLE_DRIVE_ENABLED) {
      logger.info(
        '[GoogleDriveService] GOOGLE_DRIVE_ENABLED=false — running in simulation mode'
      );
      return null;
    }

    const { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID } = env;

    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_DRIVE_FOLDER_ID) {
      logger.warn(
        '[GoogleDriveService] Missing credentials (CLIENT_EMAIL / PRIVATE_KEY / FOLDER_ID) — falling back to simulation mode'
      );
      return null;
    }

    try {
      // Normalise escaped newlines that arrive via .env strings
      const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      return google.drive({ version: 'v3', auth });
    } catch (err: any) {
      logger.error(
        `[GoogleDriveService] Failed to initialise Drive client: ${err?.message} — falling back to simulation mode`
      );
      return null;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Creates (or reuses) the full folder hierarchy for a project in Google Drive
   * and returns the resulting folder IDs and URLs.
   *
   * Hierarchy: <Root> / <Client> / <Year> / <Month> / <Day> / <VideoTitle>
   *                                                                 ├── Assets/
   *                                                                 ├── Working Files/
   *                                                                 └── Final Deliverables/
   */
  async setupProjectFolder(params: SetupProjectFolderParams): Promise<DriveProjectFolder> {
    const { clientName, videoTitle, rawFootageLink, scriptLink, submissionDate } = params;

    const year  = submissionDate.getFullYear().toString();
    const month = submissionDate.toLocaleString('default', { month: 'long' });
    const day   = submissionDate.getDate().toString();

    const hierarchyPath = `Mattwork Drive / ${clientName} / ${year} / ${month} / ${day} / ${videoTitle}`;
    logger.info(`[GoogleDriveService] Setting up project folder: "${hierarchyPath}"`);

    // ── Simulation mode ──────────────────────────────────────────────────────
    const drive = this.initDriveClient();

    if (!drive) {
      const mockBase = `drive_folder_${Math.random().toString(36).substring(2, 9)}`;
      const mockResult: DriveProjectFolder = {
        projectFolderId:      mockBase,
        projectFolderUrl:     `https://drive.google.com/drive/folders/${mockBase}`,
        assetsFolderId:       `${mockBase}_assets`,
        workingFilesFolderId: `${mockBase}_working`,
        finalsFolderId:       `${mockBase}_finals`,
        isSimulated:          true,
      };

      logger.info(`[GoogleDriveService] [SIMULATION] Folder hierarchy for "${hierarchyPath}"`);
      logger.info(`[GoogleDriveService] [SIMULATION] Sub-folders: Assets, Working Files, Final Deliverables`);
      if (rawFootageLink) logger.info(`[GoogleDriveService] [SIMULATION] Shortcut → Raw Footage: ${rawFootageLink}`);
      if (scriptLink)     logger.info(`[GoogleDriveService] [SIMULATION] Shortcut → Script: ${scriptLink}`);

      return mockResult;
    }

    // ── Real Google Drive API ────────────────────────────────────────────────
    try {
      const rootId = env.GOOGLE_DRIVE_FOLDER_ID!;

      // Build the folder hierarchy level by level
      const clientFolderId = await findOrCreateFolder(drive, clientName, rootId);
      const yearFolderId   = await findOrCreateFolder(drive, year,       clientFolderId);
      const monthFolderId  = await findOrCreateFolder(drive, month,      yearFolderId);
      const dayFolderId    = await findOrCreateFolder(drive, day,        monthFolderId);
      const videoFolderId  = await findOrCreateFolder(drive, videoTitle, dayFolderId);

      // Create sub-folders inside the video folder
      const [assetsFolderId, workingFilesFolderId, finalsFolderId] = await Promise.all([
        findOrCreateFolder(drive, 'Assets',              videoFolderId),
        findOrCreateFolder(drive, 'Working Files',       videoFolderId),
        findOrCreateFolder(drive, 'Final Deliverables',  videoFolderId),
      ]);

      // Create shortcut links in the Assets folder for source files
      const shortcutPromises: Promise<string>[] = [];
      if (rawFootageLink) {
        shortcutPromises.push(
          createShortcut(drive, 'Raw Footage Link', rawFootageLink, assetsFolderId)
        );
      }
      if (scriptLink) {
        shortcutPromises.push(
          createShortcut(drive, 'Script Link', scriptLink, assetsFolderId)
        );
      }
      await Promise.all(shortcutPromises);

      const projectFolderUrl = `https://drive.google.com/drive/folders/${videoFolderId}`;
      logger.info(
        `[GoogleDriveService] Project folder ready: ${projectFolderUrl}`
      );

      return {
        projectFolderId:      videoFolderId,
        projectFolderUrl,
        assetsFolderId,
        workingFilesFolderId,
        finalsFolderId,
        isSimulated:          false,
      };
    } catch (err: any) {
      logger.error(
        `[GoogleDriveService] Drive API error during folder setup: ${err?.message}. Falling back to simulation.`
      );

      // Graceful degradation — don't fail the whole webhook just because Drive had an error
      const fallbackBase = `drive_fallback_${Math.random().toString(36).substring(2, 9)}`;
      return {
        projectFolderId:      fallbackBase,
        projectFolderUrl:     `https://drive.google.com/drive/folders/${fallbackBase}`,
        assetsFolderId:       `${fallbackBase}_assets`,
        workingFilesFolderId: `${fallbackBase}_working`,
        finalsFolderId:       `${fallbackBase}_finals`,
        isSimulated:          true,
      };
    }
  }

  /**
   * Grants a Google Drive editor (email) access to a specific folder.
   * Called when an admin assigns an editor to a project.
   * No-op in simulation mode.
   */
  async shareFolder(folderId: string, editorEmail: string): Promise<void> {
    const drive = this.initDriveClient();
    if (!drive) {
      logger.info(
        `[GoogleDriveService] [SIMULATION] Would share folder ${folderId} with ${editorEmail}`
      );
      return;
    }

    await withRetry(`shareFolder(${folderId}, ${editorEmail})`, async () => {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: editorEmail,
        },
        sendNotificationEmail: true,
      });
      logger.info(
        `[GoogleDriveService] Granted editor access: folder=${folderId} email=${editorEmail}`
      );
    });
  }
}

export const googleDriveService = new GoogleDriveService();
