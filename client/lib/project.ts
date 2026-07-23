export function formatDateDDMMYYYY(dateString: Date | string | undefined | null): string {
  if (!dateString) return '00-00-0000';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '00-00-0000';
  // Use UTC date components for consistency with the server
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function getStandardizedProjectName(title: string, createdAt: Date | string, numberStr: string): string {
  const dateStr = formatDateDDMMYYYY(createdAt);
  const padNum = String(numberStr || '000').padStart(3, '0');
  return `${title} - ${dateStr} - ${padNum}`;
}

export function getProjectSlug(title: string, createdAt: Date | string, numberStr: string): string {
  const nameSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const dateStr = formatDateDDMMYYYY(createdAt);
  const padNum = String(numberStr || '000').padStart(3, '0');
  return `${nameSlug}-${dateStr}-${padNum}`;
}
