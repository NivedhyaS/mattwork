import { Prisma, FormSyncStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { SaveFormMappingInput } from './forms.types';

export class FormsRepository {
  private db = prisma;

  async findByGoogleFormId(googleFormId: string) {
    return this.db.connectedForm.findUnique({
      where: { googleFormId },
      include: {
        mappings: true,
        watches: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findById(id: string) {
    return this.db.connectedForm.findUnique({
      where: { id },
      include: {
        mappings: true,
        watches: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async listForms() {
    return this.db.connectedForm.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        connectedByAdmin: {
          select: { id: true, name: true, email: true },
        },
        mappings: true,
        watches: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { processedResponses: true } },
      },
    });
  }

  async saveConnectedFormWithMappingAndWatch(
    input: SaveFormMappingInput,
    adminId: string,
    watchResult?: { watchId: string; expireTime: string; pubsubTopic: string }
  ) {
    const { googleFormId, formTitle, mappings } = input;

    return this.db.$transaction(async (tx) => {
      // 1. Upsert ConnectedForm
      const connectedForm = await tx.connectedForm.upsert({
        where: { googleFormId },
        create: {
          googleFormId,
          formTitle,
          connectedByAdminId: adminId,
          syncStatus: watchResult ? FormSyncStatus.ACTIVE : FormSyncStatus.ERROR,
          lastSyncedAt: new Date(),
        },
        update: {
          formTitle,
          connectedByAdminId: adminId,
          syncStatus: watchResult ? FormSyncStatus.ACTIVE : FormSyncStatus.ERROR,
          lastSyncedAt: new Date(),
        },
      });

      // 2. Replace FormFieldMappings for this connectedForm
      await tx.formFieldMapping.deleteMany({
        where: { connectedFormId: connectedForm.id },
      });

      await tx.formFieldMapping.createMany({
        data: mappings.map((m) => ({
          connectedFormId: connectedForm.id,
          mattworkField: m.mattworkField,
          googleQuestionId: m.googleQuestionId,
          googleQuestionType: m.googleQuestionType,
        })),
      });

      // 3. Save FormWatch if watch was created
      let formWatch = null;
      if (watchResult) {
        formWatch = await tx.formWatch.create({
          data: {
            connectedFormId: connectedForm.id,
            watchId: watchResult.watchId,
            expireTime: new Date(watchResult.expireTime),
            pubsubTopic: watchResult.pubsubTopic,
          },
        });
      }

      return tx.connectedForm.findUnique({
        where: { id: connectedForm.id },
        include: {
          mappings: true,
          watches: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    });
  }

  async findExpiringWatches(thresholdDate: Date) {
    return this.db.connectedForm.findMany({
      where: {
        OR: [
          {
            watches: {
              none: {},
            },
          },
          {
            watches: {
              some: {
                expireTime: { lte: thresholdDate },
              },
            },
          },
          {
            syncStatus: {
              in: [FormSyncStatus.WATCH_EXPIRING, FormSyncStatus.WATCH_EXPIRED],
            },
          },
        ],
      },
      include: {
        watches: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async updateWatchAndStatus(
    connectedFormId: string,
    watchResult: { watchId: string; expireTime: string; pubsubTopic: string },
    status: FormSyncStatus
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.formWatch.create({
        data: {
          connectedFormId,
          watchId: watchResult.watchId,
          expireTime: new Date(watchResult.expireTime),
          pubsubTopic: watchResult.pubsubTopic,
        },
      });

      return tx.connectedForm.update({
        where: { id: connectedFormId },
        data: {
          syncStatus: status,
          lastSyncedAt: new Date(),
        },
        include: {
          mappings: true,
          watches: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    });
  }

  async updateStatus(connectedFormId: string, status: FormSyncStatus) {
    return this.db.connectedForm.update({
      where: { id: connectedFormId },
      data: {
        syncStatus: status,
      },
    });
  }
}

export const formsRepository = new FormsRepository();
