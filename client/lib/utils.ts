export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '₹0';
  const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(parsed)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(parsed);
}

export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'NEW VIDEO':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'IN_PROGRESS':
    case 'EDITING':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'REVIEW':
    case 'EDITING REVIEW':
    case 'REVISION 1 REVIEW':
    case 'REVISION 2 REVIEW':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'REVISION':
    case 'REVISION 1':
    case 'REVISION 2':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    case 'COMPLETED':
    case 'FINAL DRAFT':
    case 'UPLOADED':
    case 'PAID':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'CANCELLED':
    case 'FAILED':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'ON_HOLD':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-800';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  }
}

export function getPriorityBadgeClass(priority: string): string {
  switch (priority.toUpperCase()) {
    case 'URGENT':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    case 'MEDIUM':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'LOW':
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-800';
  }
}

export function checkActiveRoute(pathname: string, linkHref: string): boolean {
  const cleanPath = pathname.replace(/\/$/, '') || '/';
  const cleanHref = linkHref.replace(/\/$/, '') || '/';

  const parentLandingRoutes = ['/admin', '/editor', '/client'];
  if (parentLandingRoutes.includes(cleanHref)) {
    return cleanPath === cleanHref;
  }
  return cleanPath === cleanHref || cleanPath.startsWith(cleanHref + '/');
}
