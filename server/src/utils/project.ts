import prisma from '../config/database';

export function getProjectNumber(index: number): string {
  return String(index).padStart(3, '0');
}

export function formatDateDDMMYYYY(dateString: Date | string): string {
  const d = new Date(dateString);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function getStandardizedProjectName(title: string, createdAt: Date | string, numberStr: string): string {
  const dateStr = formatDateDDMMYYYY(createdAt);
  return `${title} - ${dateStr} - ${numberStr}`;
}

export function getProjectSlug(title: string, createdAt: Date | string, numberStr: string): string {
  const nameSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const dateStr = formatDateDDMMYYYY(createdAt);
  return `${nameSlug}-${dateStr}-${numberStr}`;
}

/**
 * Resolves a slug like name-slug-dd-mm-yyyy-014 back to the database project CUID.
 */
export async function resolveProjectId(idOrSlug: string): Promise<string> {
  if (!idOrSlug) return idOrSlug;
  // If it's a standard CUID format (starts with 'c' and length 25)
  if (idOrSlug.length === 25 && idOrSlug.startsWith('c')) {
    return idOrSlug;
  }

  // Parse project number from slug (last 3 digits at the end)
  const match = idOrSlug.match(/-(\d{3})$/);
  if (match) {
    const projectNumber = parseInt(match[1], 10);
    const skip = projectNumber - 1;
    if (skip >= 0) {
      const p = await prisma.project.findFirst({
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' }
        ],
        skip,
        select: { id: true }
      });
      if (p) return p.id;
    }
  }
  return idOrSlug;
}
