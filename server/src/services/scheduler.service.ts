import { formsRepository } from '../modules/forms/forms.repository';
import { formsService } from '../modules/forms/forms.service';
import { logger } from '../config/logger';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;

  /**
   * Initializes the background scheduler service.
   * Runs the watch renewal job once shortly after boot (10 seconds) and then every 24 hours.
   */
  init() {
    logger.info('⏰ [SchedulerService] Initializing background scheduler service...');

    // Run initial watch renewal check 10 seconds after server startup
    setTimeout(() => {
      this.runWatchRenewalJob().catch((err) => {
        logger.error(`[SchedulerService] Initial watch renewal job execution error: ${err?.message || err}`);
      });
    }, 10000);

    // Schedule recurring 24-hour interval
    this.timer = setInterval(() => {
      this.runWatchRenewalJob().catch((err) => {
        logger.error(`[SchedulerService] Scheduled watch renewal job error: ${err?.message || err}`);
      });
    }, TWENTY_FOUR_HOURS_MS);
  }

  /**
   * Main background watch renewal job.
   * Finds all watches expiring within 24 hours (or already expired) and attempts renewal for each.
   */
  async runWatchRenewalJob() {
    logger.info('⏰ [SchedulerService] Watch renewal job started...');

    const thresholdDate = new Date(Date.now() + TWENTY_FOUR_HOURS_MS);
    const expiringForms = await formsRepository.findExpiringWatches(thresholdDate);

    logger.info(
      `[SchedulerService] Found ${expiringForms.length} connected form(s) requiring watch renewal (expiry <= ${thresholdDate.toISOString()})`
    );

    let renewedCount = 0;
    let failedCount = 0;

    for (const form of expiringForms) {
      const latestWatch = form.watches[0];
      const oldExpiry = latestWatch?.expireTime ? new Date(latestWatch.expireTime).toISOString() : 'N/A';
      const watchId = latestWatch?.watchId || 'NONE';

      try {
        logger.info(
          `[SchedulerService] Renewing watch for Form ID: ${form.googleFormId} | ConnectedForm ID: ${form.id} | Watch ID: ${watchId} | Old Expiry: ${oldExpiry}`
        );

        const result = await formsService.renewWatch(form.id);

        if (result.success) {
          renewedCount++;
          logger.info(
            `[SchedulerService] Watch renewed | Form ID: ${form.googleFormId} | Watch ID: ${result.watchId} | Old Expiry: ${oldExpiry} | New Expiry: ${result.expireTime}`
          );
        } else {
          failedCount++;
          logger.error(
            `[SchedulerService] Watch renewal failed | Form ID: ${form.googleFormId} | Watch ID: ${watchId} | Error: ${result.error}`
          );
        }
      } catch (err: any) {
        failedCount++;
        logger.error(
          `[SchedulerService] Exception during watch renewal for Form ID: ${form.googleFormId} | Watch ID: ${watchId}: ${err?.message || err}`
        );
      }
    }

    logger.info(
      `⏰ [SchedulerService] Watch renewal job processing complete | Total: ${expiringForms.length} | Renewed: ${renewedCount} | Failed: ${failedCount}`
    );

    return {
      total: expiringForms.length,
      renewed: renewedCount,
      failed: failedCount,
    };
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const schedulerService = new SchedulerService();
