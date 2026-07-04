import { google, sheets_v4 } from 'googleapis';
import { logger } from '../config/logger';
import { env } from '../config/env';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/** Column headers written to row 1 of the sheet (if empty). */
const HEADER_ROW = [
  'Project ID',
  'Submission ID',
  'Client Name',
  'Video Title',
  'Submission Date',
  'Deadline',
  'Status',
  'Assigned Editor',
  'Drive Folder URL',
  'Client Price',
  'Editor Price',
  'Profit',
  'Last Updated',
];

// ─── Retry helper (mirrors the one in googleDrive.ts) ─────────────────────────

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
          `[GoogleSheetsService] "${label}" failed after ${attempt} attempt(s): ${err?.message}`
        );
        throw err;
      }

      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      logger.warn(
        `[GoogleSheetsService] "${label}" attempt ${attempt} failed — retrying in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('withRetry: unreachable');
}

// ─── Snapshot type ────────────────────────────────────────────────────────────

/**
 * A lightweight snapshot of everything we need to write one sheet row.
 * Built from the raw Prisma project + relations in project.service.ts.
 */
export interface ProjectSheetSnapshot {
  id: string;
  formLink: string | null;
  clientName: string;
  title: string;
  createdAt: Date;
  dueDate: Date | null;
  status: string;
  editorName: string | null;
  driveFolder: string | null;
  clientPrice: number | null;
  editorPrice: number | null;
}

// ─── Service class ────────────────────────────────────────────────────────────

export class GoogleSheetsService {
  /**
   * Returns an authenticated Sheets v4 client when real credentials are
   * available and `GOOGLE_SHEETS_ENABLED=true`, or `null` for simulation mode.
   */
  private initSheetsClient(): sheets_v4.Sheets | null {
    if (!env.GOOGLE_SHEETS_ENABLED) {
      return null;
    }

    const {
      GOOGLE_CLIENT_EMAIL,
      GOOGLE_PRIVATE_KEY,
      GOOGLE_SHEETS_SPREADSHEET_ID,
    } = env;

    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
      logger.warn(
        '[GoogleSheetsService] Missing credentials or SPREADSHEET_ID — falling back to simulation'
      );
      return null;
    }

    try {
      const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      return google.sheets({ version: 'v4', auth });
    } catch (err: any) {
      logger.error(
        `[GoogleSheetsService] Failed to initialise Sheets client: ${err?.message}`
      );
      return null;
    }
  }

  // ── Header management ───────────────────────────────────────────────────────

  /**
   * Writes header row to A1 if the first row is empty or doesn't exist yet.
   */
  private async ensureHeaderRow(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string
  ): Promise<void> {
    await withRetry('ensureHeaderRow', async () => {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:M1`,
      });

      const firstRow = res.data.values?.[0];
      if (firstRow && firstRow.length > 0) {
        // Header already exists
        return;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:M1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADER_ROW],
        },
      });

      logger.info('[GoogleSheetsService] Header row created');
    });
  }

  // ── Row lookup ──────────────────────────────────────────────────────────────

  /**
   * Scans column A for `projectId` and returns the 1-based row index,
   * or `null` if not found.
   */
  private async findRowByProjectId(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string,
    projectId: string
  ): Promise<number | null> {
    return withRetry(`findRow(${projectId})`, async () => {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:A`,
      });

      const rows = res.data.values;
      if (!rows) return null;

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === projectId) {
          return i + 1; // 1-based
        }
      }
      return null;
    });
  }

  // ── Row data builder ────────────────────────────────────────────────────────

  private buildRowValues(snapshot: ProjectSheetSnapshot): string[] {
    const profit =
      snapshot.clientPrice != null && snapshot.editorPrice != null
        ? (snapshot.clientPrice - snapshot.editorPrice).toFixed(2)
        : '';

    return [
      snapshot.id,
      snapshot.formLink || '',
      snapshot.clientName,
      snapshot.title,
      snapshot.createdAt.toISOString(),
      snapshot.dueDate ? snapshot.dueDate.toISOString() : '',
      snapshot.status,
      snapshot.editorName || 'Unassigned',
      snapshot.driveFolder || '',
      snapshot.clientPrice != null ? snapshot.clientPrice.toFixed(2) : '',
      snapshot.editorPrice != null ? snapshot.editorPrice.toFixed(2) : '',
      profit,
      new Date().toISOString(),
    ];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Synchronise a project record to the Google Sheet.
   * - If the project already has a row (matched by Project ID in column A), that row is updated.
   * - Otherwise a new row is appended.
   *
   * This method is designed to be called fire-and-forget — it catches its own
   * errors internally so it never propagates failures to the caller.
   */
  async syncProject(snapshot: ProjectSheetSnapshot): Promise<void> {
    const sheets = this.initSheetsClient();

    if (!sheets) {
      logger.info(
        `[GoogleSheetsService] [SIMULATION] Would sync project ${snapshot.id} (${snapshot.title}) to sheet — ` +
        `status=${snapshot.status}, editor=${snapshot.editorName || 'Unassigned'}`
      );
      return;
    }

    const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const sheetName = env.GOOGLE_SHEETS_SHEET_NAME;

    try {
      // Ensure header row exists
      await this.ensureHeaderRow(sheets, spreadsheetId, sheetName);

      const rowValues = this.buildRowValues(snapshot);

      // Check if a row already exists for this project
      const existingRow = await this.findRowByProjectId(
        sheets,
        spreadsheetId,
        sheetName,
        snapshot.id
      );

      if (existingRow) {
        // Update existing row
        await withRetry(`updateRow(${existingRow})`, async () => {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${existingRow}:M${existingRow}`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [rowValues],
            },
          });
        });

        logger.info(
          `[GoogleSheetsService] Updated row ${existingRow} for project ${snapshot.id}`
        );
      } else {
        // Append new row
        await withRetry('appendRow', async () => {
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:M`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [rowValues],
            },
          });
        });

        logger.info(
          `[GoogleSheetsService] Appended new row for project ${snapshot.id}`
        );
      }
    } catch (err: any) {
      // Never propagate — this is fire-and-forget
      logger.error(
        `[GoogleSheetsService] Failed to sync project ${snapshot.id}: ${err?.message}`
      );
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
