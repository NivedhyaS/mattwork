import prisma from '../config/database';
import { PaginationParams, PaginatedResult } from '../types';

/**
 * Generic base repository providing common CRUD operations.
 * Module-specific repositories extend this with domain-specific queries.
 */
export abstract class BaseRepository<
  TModel,
  TCreateInput,
  TUpdateInput,
  TWhereInput = Record<string, unknown>
> {
  protected readonly db = prisma;

  abstract readonly modelName: string;

  /**
   * Get paginated results with optional filtering
   */
  protected async paginate(
    findManyFn: (args: {
      skip: number;
      take: number;
      orderBy: Record<string, string>;
    }) => Promise<TModel[]>,
    countFn: () => Promise<number>,
    { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' }: PaginationParams = {}
  ): Promise<PaginatedResult<TModel>> {
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 10;
    const skip = (parsedPage - 1) * parsedLimit;
    const [data, total] = await Promise.all([
      findManyFn({ skip, take: parsedLimit, orderBy: { [sortBy]: sortOrder } }),
      countFn(),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);
    return {
      data,
      meta: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };
  }
}
