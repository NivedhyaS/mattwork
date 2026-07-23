import { google, drive_v3 } from 'googleapis';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { googleDriveLimiter } from '../utils/concurrency';
import type { DriveProjectFolder, SetupProjectFolderParams } from './googleDrive.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/** Sub-folders created inside every video-title folder */
const SUBFOLDERS = ['Assets', 'Working Files', 'Final Deliverables'] as const;

// ─── ID extraction ────────────────────────────────────────────────────────────

/**
 * Extracts the raw Google Drive / Docs file or folder ID from any of the
 * common share-link formats:
 *
 *   https://drive.google.com/file/d/<ID>/view
 *   https://drive.google.com/open?id=<ID>
 *   https://docs.google.com/document/d/<ID>/edit   (and other Workspace apps)
 *   https://drive.google.com/drive/folders/<ID>
 *
 * Returns `null` when no recognisable ID pattern is found.
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;

  // Pattern 1: /file/d/<ID>/ or /document/d/<ID>/ or /spreadsheets/d/<ID>/ etc.
  const slashD = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (slashD) return slashD[1];

  // Pattern 2: ?id=<ID> or &id=<ID>
  const queryId = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryId) return queryId[1];

  // Pattern 3: /folders/<ID>
  const folder = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folder) return folder[1];

  return null;
}

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
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const existing = searchRes.data.files?.find((f) => f.name === safeName);
    if (existing?.id) {
      logger.info(
        `[GoogleDriveService] Reusing existing folder "${safeName}" (id=${existing.id})`
      );
      return existing.id;
    }

    // Create the folder
    const createRes = await drive.files.create({
      supportsAllDrives: true,
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
 * Creates a Drive shortcut pointing to a Google Drive file/folder inside the
 * given parent folder.  The shortcut target must be a Drive **file ID** — not a
 * full URL — so we call `extractGoogleDriveId` first.
 *
 * If the ID cannot be extracted from `targetUrl`, the shortcut is skipped
 * gracefully (logs an error, returns an empty string) so the rest of the
 * folder hierarchy continues unaffected.
 *
 * If a shortcut with the same name already exists under `parentId` it is
 * reused without creating a duplicate.
 */
async function createShortcut(
  drive: drive_v3.Drive,
  name: string,
  targetUrl: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'Link';

  // ── Extract the Drive file/folder ID from the source URL ────────────────
  const targetId = extractGoogleDriveId(targetUrl);

  if (!targetId) {
    logger.error(
      `[GoogleDriveService] createShortcut("${safeName}"): could not extract a Drive ID from URL "${targetUrl}" — skipping shortcut creation`
    );
    return '';
  }

  logger.info(
    `[GoogleDriveService] createShortcut("${safeName}"): source URL="${targetUrl}" → extracted ID="${targetId}"`
  );

  return withRetry(`createShortcut("${safeName}")`, async () => {
    // ── Check for an existing shortcut with the same name in this folder ──
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

    // ── Create the shortcut with the extracted file ID ───────────────────
    const createRes = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: SHORTCUT_MIME,
        parents: [parentId],
        shortcutDetails: {
          targetId,   // ✓ Drive file/folder ID — NOT the full URL
        },
      },
      fields: 'id',
    });

    const newId = createRes.data.id!;
    logger.info(
      `[GoogleDriveService] Created shortcut "${safeName}" | sourceURL=${targetUrl} | targetId=${targetId} | shortcutId=${newId}`
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

    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } = env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_FOLDER_ID) {
      logger.warn(
        '[GoogleDriveService] Missing OAuth2 credentials (CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN / FOLDER_ID) — falling back to simulation mode'
      );
      return null;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        refresh_token: GOOGLE_REFRESH_TOKEN,
      });

      return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (err: any) {
      logger.error(
        `[GoogleDriveService] Failed to initialise Drive client: ${err?.message} — falling back to simulation mode`
      );
      return null;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Recursively copies all files and subfolders from sourceFolderId to destFolderId.
   */
  async copyFolderRecursively(
    drive: drive_v3.Drive,
    sourceFolderId: string,
    destFolderId: string
  ): Promise<void> {
    // 1. Fetch file list with retry
    const files = await withRetry(`list files in folder ${sourceFolderId}`, async () => {
      const listRes = await drive.files.list({
        q: `'${sourceFolderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive',
        pageSize: 1000,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      return listRes.data.files || [];
    });

    // 2. Iterate through each file
    for (const file of files) {
      if (!file.id || !file.name) continue;

      try {
        if (file.mimeType === FOLDER_MIME) {
          // Find or create subfolder with retry
          const subfolderId = await findOrCreateFolder(drive, file.name, destFolderId);
          // Recursively copy subfolder contents
          await this.copyFolderRecursively(drive, file.id, subfolderId);
        } else {
          // Copy individual file with retry
          await withRetry(`copy file "${file.name}" (id: ${file.id})`, async () => {
            await drive.files.copy({
              fileId: file.id!,
              supportsAllDrives: true,
              requestBody: {
                name: file.name!,
                parents: [destFolderId],
              },
              fields: 'id',
            });
          });
          logger.info(`[GoogleDriveService] Copied file "${file.name}" → dest ${destFolderId}`);
        }
      } catch (err: any) {
        // Log full API error detail for any copy failure
        const status = err?.status ?? err?.code ?? err?.response?.status ?? 'unknown';
        const apiErrors = err?.errors ?? err?.response?.data?.error?.errors ?? [];
        logger.error(
          `[GoogleDriveService] Error copying "${file.name}" (id=${file.id}): HTTP ${status} — ${err?.message}` +
          (apiErrors.length ? ` | details=${JSON.stringify(apiErrors)}` : '')
        );
      }
    }
  }

  async setupProjectFolder(params: SetupProjectFolderParams): Promise<DriveProjectFolder> {
    return googleDriveLimiter.run(async () => {
      const { clientName, videoTitle, driveFolderLink, submissionDate } = params;

      const year  = submissionDate.getFullYear().toString();
      const month = submissionDate.toLocaleString('default', { month: 'long' });
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dayStr = `${pad(submissionDate.getDate())}-${pad(submissionDate.getMonth() + 1)}-${submissionDate.getFullYear()}`;

      const hierarchyPath = `Mattwork Drive / ${clientName} / ${year} / ${month} / ${dayStr} / ${videoTitle}`;
      logger.info(`[GoogleDriveService] Setting up project folder: "${hierarchyPath}"`);

      // ── Simulation mode ──────────────────────────────────────────────────────
      const drive = this.initDriveClient();

      if (!drive) {
        const mockBase = `drive_folder_${Math.random().toString(36).substring(2, 9)}`;
        const mockResult: DriveProjectFolder = {
          projectFolderId:      mockBase,
          projectFolderUrl:     `https://drive.google.com/drive/folders/${mockBase}`,
          assetsFolderId:       mockBase,
          workingFilesFolderId: mockBase,
          finalsFolderId:       mockBase,
          isSimulated:          true,
        };

        logger.info(`[GoogleDriveService] [SIMULATION] Folder hierarchy for "${hierarchyPath}"`);
        logger.info(`[GoogleDriveService] [SIMULATION] Copied entire contents from source folder: ${driveFolderLink}`);

        return mockResult;
      }

      // ── Real Google Drive API ────────────────────────────────────────────────
      try {
        const rootId = env.GOOGLE_DRIVE_FOLDER_ID!;

        // Build the folder hierarchy level by level
        const clientFolderId = await findOrCreateFolder(drive, clientName, rootId);
        const yearFolderId   = await findOrCreateFolder(drive, year,       clientFolderId);
        const monthFolderId  = await findOrCreateFolder(drive, month,      yearFolderId);
        const dayFolderId    = await findOrCreateFolder(drive, dayStr,     monthFolderId);
        const videoFolderId  = await findOrCreateFolder(drive, videoTitle, dayFolderId);

        // Do NOT create additional subfolders such as Assets, Working Files, or Deliverables.
        // Map all subfolder fields to the root video folder ID for compatibility.
        const assetsFolderId = videoFolderId;
        const workingFilesFolderId = videoFolderId;
        const finalsFolderId = videoFolderId;

        // Copy source folder contents to destination Video folder in the background (async)
        const sourceFolderId = extractGoogleDriveId(driveFolderLink);
        if (sourceFolderId) {
          logger.info(`[GoogleDriveService] Initiating async copy from ${sourceFolderId} to ${videoFolderId}`);
          this.copyFolderRecursively(drive, sourceFolderId, videoFolderId)
            .then(() => {
              logger.info(`[GoogleDriveService] Successfully copied all files from ${sourceFolderId} to ${videoFolderId}`);
            })
            .catch((copyErr: any) => {
              logger.error(`[GoogleDriveService] Failed to copy files recursively from ${sourceFolderId} to ${videoFolderId}: ${copyErr?.message || copyErr}`);
            });
        } else {
          logger.warn(`[GoogleDriveService] Could not extract source folder ID from URL: ${driveFolderLink}`);
        }

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
          `[GoogleDriveService] Drive API error during folder setup: ${err?.message}.`
        );
        throw new Error(`Google Drive API failed: ${err?.message}`);
      }
    });
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

  /**
   * Revokes a Google Drive editor's access (by email) to a specific folder.
   * No-op in simulation mode.
   */
  async unshareFolder(folderId: string, editorEmail: string): Promise<void> {
    const drive = this.initDriveClient();
    if (!drive) {
      logger.info(
        `[GoogleDriveService] [SIMULATION] Would revoke access to folder ${folderId} for ${editorEmail}`
      );
      return;
    }

    await withRetry(`unshareFolder(${folderId}, ${editorEmail})`, async () => {
      // Fetch permissions for the folder to find the permission ID corresponding to the email
      const listRes = await drive.permissions.list({
        fileId: folderId,
        fields: 'permissions(id, emailAddress)',
      });

      const permission = listRes.data.permissions?.find(
        (p) => p.emailAddress?.toLowerCase() === editorEmail.toLowerCase()
      );

      if (permission?.id) {
        await drive.permissions.delete({
          fileId: folderId,
          permissionId: permission.id,
        });
        logger.info(
          `[GoogleDriveService] Revoked editor access: folder=${folderId} email=${editorEmail}`
        );
      } else {
        logger.info(
          `[GoogleDriveService] No permission found for email=${editorEmail} on folder=${folderId}`
        );
      }
    });
  }
}

export const googleDriveService = new GoogleDriveService();
