import { Role, ProjectStatus } from '@prisma/client';
import { clientRepository } from './client.repository';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/password.utils';
import prisma from '../../config/database';
import { AuthUser } from '../../types/express';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
} from './client.validator';

// ── Status set that counts as "completed work" ────────────────────────────────
// Maps to the final stages of the Kanban pipeline where delivery is confirmed.
// Must stay in sync with getClientStatus() in the client dashboard UI,
// which maps both UPLOADED and COMPLETED to 'delivered'.
export const COMPLETED_STATUSES: ProjectStatus[] = [
  ProjectStatus.UPLOADED,
];

export class ClientService {
  // ── Standard CRUD ─────────────────────────────────────────────────────────

  async listClients(query: ListClientsQuery) {
    return clientRepository.findAll(query);
  }

  async getClientById(id: string) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('Client not found');
    return client;
  }

  async getClientByUserId(userId: string) {
    const client = await clientRepository.findByUserId(userId);
    if (!client) throw ApiError.notFound('Client profile not found');
    return client;
  }

  async createClient(input: CreateClientInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const hashedPassword = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: Role.CLIENT,
        client: {
          create: {
            company: input.company,
            phone: input.phone,
            address: input.address,
            city: input.city,
            country: input.country,
            notes: input.notes,
            currency: input.currency,
          },
        },
      },
      include: { client: true },
    });

    const { password: _pw, refreshToken: _rt, ...safeUser } = user;
    return safeUser;
  }

  async updateClient(id: string, input: UpdateClientInput) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('Client not found');
    return clientRepository.update(id, input);
  }

  async deleteClient(id: string) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('Client not found');
    // Cascade delete via Prisma — user deletion cascades to client
    return prisma.user.delete({ where: { id: client.userId } });
  }

  // ── Balance / Credit ───────────────────────────────────────────────────────

  /**
   * Compute the client's credit balance on-demand (never stored).
   *
   * Access control (enforced here, not only in router):
   *   ADMIN  → any clientId
   *   CLIENT → only their own clientId (403 otherwise)
   *   EDITOR → always 403
   */
  async getClientBalance(clientId: string, requester: AuthUser) {
    // EDITOR → hard 403
    if (requester.role === Role.EDITOR) {
      throw ApiError.forbidden('Editors do not have access to client balance data');
    }

    // CLIENT → resolve their own profile id, compare
    if (requester.role === Role.CLIENT) {
      const myProfile = await prisma.client.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!myProfile) throw ApiError.notFound('Client profile not found');
      if (myProfile.id !== clientId) {
        throw ApiError.forbidden('You can only view your own balance');
      }
    }

    // Fetch the client record (confirms existence for all roles)
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, advancePaid: true },
    });
    if (!client) throw ApiError.notFound('Client not found');

    // ── completedWorkValue: sum of clientPrice for all completed projects ──
    const completedAgg = await prisma.project.aggregate({
      where: {
        clientId,
        status: { in: COMPLETED_STATUSES },
        clientPrice: { not: null },
      },
      _sum: { clientPrice: true },
      _avg: { clientPrice: true },
      _count: { clientPrice: true },
    });

    const completedWorkValue = Number(completedAgg._sum.clientPrice ?? 0);

    // ── advancePaid ────────────────────────────────────────────────────────
    const advancePaid = Number(client.advancePaid ?? 0);

    // ── remainingCredit ────────────────────────────────────────────────────
    const remainingCredit = advancePaid - completedWorkValue;

    // ── equivalentRemainingVideos ──────────────────────────────────────────
    // Average is taken from this client's own completed projects only.
    // If no completed projects yet, fall back to their most recently quoted
    // clientPrice (any status), or null with an explanatory note if nothing exists.
    let equivalentRemainingVideos: number | null = null;
    let averageNote: string | undefined;

    const completedCount  = completedAgg._count.clientPrice;
    const completedAvg    = Number(completedAgg._avg.clientPrice ?? 0);

    if (completedCount > 0 && completedAvg > 0) {
      equivalentRemainingVideos = Math.floor(remainingCredit / completedAvg);
    } else {
      // Fall back to most recently quoted clientPrice across any project status
      const latestProject = await prisma.project.findFirst({
        where: {
          clientId,
          clientPrice: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { clientPrice: true },
      });

      if (latestProject?.clientPrice && Number(latestProject.clientPrice) > 0) {
        equivalentRemainingVideos = Math.floor(
          remainingCredit / Number(latestProject.clientPrice)
        );
        averageNote =
          'Based on latest quoted price (no completed projects yet to average from)';
      } else {
        averageNote =
          'Cannot compute — no clientPrice data found for this client yet';
      }
    }

    // ── completedProjects: line items for the breakdown modal ─────────────
    const completedProjects = await prisma.project.findMany({
      where: {
        clientId,
        status: { in: COMPLETED_STATUSES },
        clientPrice: { not: null },
      },
      select: {
        id: true,
        title: true,
        clientPrice: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      advancePaid,
      completedWorkValue,
      remainingCredit,
      equivalentRemainingVideos,
      completedProjects: completedProjects.map(p => ({
        id: p.id,
        title: p.title,
        clientPrice: Number(p.clientPrice),
        deliveredAt: p.updatedAt.toISOString(),
      })),
      ...(averageNote && { averageNote }),
    };
  }
}

export const clientService = new ClientService();
