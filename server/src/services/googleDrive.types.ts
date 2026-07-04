/**
 * Type definitions for the Google Drive service.
 * These are shared between googleDrive.ts and any consumers (webhook controller, etc.)
 */

export interface DriveProjectFolder {
  /** Google Drive folder ID of the video-title-level folder */
  projectFolderId: string;
  /** Shareable URL of the video-title-level folder */
  projectFolderUrl: string;
  /** Google Drive folder ID of the Assets sub-folder */
  assetsFolderId: string;
  /** Google Drive folder ID of the Working Files sub-folder */
  workingFilesFolderId: string;
  /** Google Drive folder ID of the Final Deliverables sub-folder */
  finalsFolderId: string;
  /**
   * `true`  → credentials were missing; mock IDs were returned (no Drive API calls made).
   * `false` → real Google Drive API was used successfully.
   */
  isSimulated: boolean;
}

export interface SetupProjectFolderParams {
  clientName: string;
  videoTitle: string;
  rawFootageLink: string;
  scriptLink: string;
  submissionDate: Date;
}
