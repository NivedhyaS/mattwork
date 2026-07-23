'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import {
  fetchConnectedForms,
  previewForm,
  saveFormMapping,
  renewFormWatch,
  syncFormResponses,
  ConnectedForm,
  FormDetails,
  FormQuestion,
  MattworkFormField,
  FieldMapping,
  FormSyncStatus,
} from '@/lib/forms';
import { cn, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Label from '@/components/ui/label';
import Drawer from '@/components/ui/drawer';
import { useAuthStore } from '@/store/authStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const MATTWORK_FIELDS: Array<{ value: MattworkFormField; label: string; required: boolean; allowedTypes?: string[] }> = [
  { value: 'CLIENT_NAME', label: 'Client Name', required: true },
  { value: 'VIDEO_TITLE', label: 'Video Title', required: true },
  { value: 'PROJECT_TYPE', label: 'Project Type', required: false },
  { value: 'ASSIGNED_DATE', label: 'Assigned Date', required: false, allowedTypes: ['DATE'] },
  { value: 'DEADLINE_DATE', label: 'Deadline Date', required: false, allowedTypes: ['DATE'] },
  { value: 'MATERIALS_LINK', label: 'Materials Link', required: false },
];

const REQUIRED_FIELDS: MattworkFormField[] = ['CLIENT_NAME', 'VIDEO_TITLE'];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: FormSyncStatus }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </span>
      );
    case 'WATCH_EXPIRING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="h-3 w-3" />
          Expiring Soon
        </span>
      );
    case 'WATCH_EXPIRED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
          <XCircle className="h-3 w-3" />
          Watch Expired
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <AlertTriangle className="h-3 w-3" />
          Error
        </span>
      );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
        <FileText className="h-10 w-10 text-slate-400" />
      </div>
      <h3 className="text-[20px] font-bold text-slate-900 dark:text-white mb-2">No Google Forms connected</h3>
      <p className="text-[15px] text-slate-500 mb-8 max-w-md">
        Connect a Google Form to automatically create Mattwork projects when new responses come in.
      </p>
      <Button variant="primary" onClick={onConnect}>
        <Plus className="h-4 w-4 mr-2" />
        Connect Your First Form
      </Button>
    </div>
  );
}

// ─── Question Mapping Row ─────────────────────────────────────────────────────

interface QuestionMappingRowProps {
  question: FormQuestion;
  selectedField: MattworkFormField | 'IGNORE' | '';
  usedFields: Set<MattworkFormField>;
  onChange: (questionId: string, field: MattworkFormField | 'IGNORE' | '') => void;
  error?: string;
}

function QuestionMappingRow({ question, selectedField, usedFields, onChange, error }: QuestionMappingRowProps) {
  const fieldDef = MATTWORK_FIELDS.find(f => f.value === selectedField);
  const isDateTypeMismatch =
    fieldDef?.allowedTypes &&
    !fieldDef.allowedTypes.includes(question.googleQuestionType.toUpperCase());

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      error || isDateTypeMismatch
        ? 'border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/20'
        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'
    )}>
      <div className="flex items-start gap-3">
        {/* Question info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
              {question.title}
            </span>
            {question.required && (
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider shrink-0">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {question.googleQuestionType}
            </span>
            <span className="text-[11px] text-slate-400 font-mono truncate">
              id: {question.googleQuestionId.slice(0, 12)}…
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-slate-350 shrink-0 mt-1" />

        {/* Mattwork field selector */}
        <div className="w-52 shrink-0">
          <select
            value={selectedField}
            onChange={(e) => onChange(question.googleQuestionId, e.target.value as MattworkFormField | 'IGNORE' | '')}
            className="w-full text-[14px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            aria-label={`Map ${question.title} to Mattwork field`}
          >
            <option value="">— Ignore —</option>
            {MATTWORK_FIELDS.map(f => (
              <option
                key={f.value}
                value={f.value}
                disabled={usedFields.has(f.value) && selectedField !== f.value}
              >
                {f.label}{f.required ? ' *' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inline errors */}
      {isDateTypeMismatch && !error && (
        <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400 font-medium">
          "{fieldDef?.label}" requires a DATE-type question, but this question is "{question.googleQuestionType}".
        </p>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400 font-medium">{error}</p>
      )}
    </div>
  );
}

// ─── Connect Form Drawer ──────────────────────────────────────────────────────

interface ConnectFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DrawerStep = 'url' | 'mapping';

function ConnectFormDrawer({ isOpen, onClose, onSuccess }: ConnectFormDrawerProps) {
  const [step, setStep] = useState<DrawerStep>('url');
  const [formUrl, setFormUrl] = useState('');
  const [formDetails, setFormDetails] = useState<FormDetails | null>(null);
  const [mappings, setMappings] = useState<Record<string, MattworkFormField | 'IGNORE' | ''>>({});
  const [detectError, setDetectError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: saveFormMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-forms'] });
      onSuccess();
      handleClose();
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.message || 'Failed to save mapping. Please try again.');
    },
  });

  const handleClose = useCallback(() => {
    setStep('url');
    setFormUrl('');
    setFormDetails(null);
    setMappings({});
    setDetectError('');
    setSaveError('');
    onClose();
  }, [onClose]);

  const handleDetect = async () => {
    if (!formUrl.trim()) {
      setDetectError('Please enter a Google Form URL or ID.');
      return;
    }
    setDetectError('');
    setIsDetecting(true);
    try {
      const details = await previewForm(formUrl.trim());
      setFormDetails(details);
      // Pre-initialise all questions to empty
      const initial: Record<string, MattworkFormField | 'IGNORE' | ''> = {};
      details.questions.forEach(q => { initial[q.googleQuestionId] = ''; });
      setMappings(initial);
      setStep('mapping');
    } catch (err: any) {
      setDetectError(err?.response?.data?.message || 'Failed to detect form. Check the URL and try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleMappingChange = (questionId: string, field: MattworkFormField | 'IGNORE' | '') => {
    setMappings(prev => ({ ...prev, [questionId]: field }));
    setSaveError('');
  };

  // Derived state
  const usedFields = new Set<MattworkFormField>(
    Object.values(mappings).filter(v => v && v !== 'IGNORE') as MattworkFormField[]
  );

  const validationErrors = (() => {
    const errors: Record<string, string> = {};
    if (!formDetails) return errors;

    const mappedFieldsToQuestion = new Map<MattworkFormField, string>();
    for (const [qId, field] of Object.entries(mappings)) {
      if (field && field !== 'IGNORE') {
        mappedFieldsToQuestion.set(field as MattworkFormField, qId);
      }
    }

    // Check required fields
    for (const required of REQUIRED_FIELDS) {
      if (!mappedFieldsToQuestion.has(required)) {
        const fieldLabel = MATTWORK_FIELDS.find(f => f.value === required)?.label;
        errors['__required__' + required] = `"${fieldLabel}" is required and must be mapped.`;
      }
    }

    // Check date type compatibility
    for (const [qId, field] of Object.entries(mappings)) {
      if (!field || field === 'IGNORE') continue;
      const fieldDef = MATTWORK_FIELDS.find(f => f.value === field);
      const question = formDetails.questions.find(q => q.googleQuestionId === qId);
      if (fieldDef?.allowedTypes && question) {
        if (!fieldDef.allowedTypes.includes(question.googleQuestionType.toUpperCase())) {
          errors[qId] = `"${fieldDef.label}" requires a DATE-type question.`;
        }
      }
    }

    return errors;
  })();

  const globalErrors = Object.entries(validationErrors)
    .filter(([k]) => k.startsWith('__required__'))
    .map(([, v]) => v);

  const perQuestionErrors: Record<string, string> = Object.fromEntries(
    Object.entries(validationErrors).filter(([k]) => !k.startsWith('__required__'))
  );

  const isValid = Object.keys(validationErrors).length === 0;

  const handleSave = () => {
    if (!formDetails || !isValid) return;
    setSaveError('');

    const fieldMappings: FieldMapping[] = Object.entries(mappings)
      .filter(([, field]) => field && field !== 'IGNORE')
      .map(([qId, field]) => {
        const question = formDetails.questions.find(q => q.googleQuestionId === qId)!;
        return {
          mattworkField: field as MattworkFormField,
          googleQuestionId: qId,
          googleQuestionType: question.googleQuestionType,
        };
      });

    saveMutation.mutate({
      googleFormId: formDetails.googleFormId,
      formTitle: formDetails.formTitle,
      mappings: fieldMappings,
    });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'url' ? 'Connect Google Form' : `Map Fields — ${formDetails?.formTitle ?? ''}`}
      description={
        step === 'url'
          ? 'Paste a Google Form URL to detect its questions.'
          : 'Map each Google Form question to a Mattwork project field.'
      }
      size="lg"
    >
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* ── Step 1: URL input ── */}
        {step === 'url' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-url">Google Form URL or Form ID</Label>
              <Input
                id="form-url"
                placeholder="https://docs.google.com/forms/d/..."
                value={formUrl}
                onChange={(e) => { setFormUrl(e.target.value); setDetectError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDetect(); }}
                className="font-mono text-[13px]"
                disabled={isDetecting}
              />
              {detectError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-rose-700 dark:text-rose-400">{detectError}</p>
                </div>
              )}
            </div>

            <p className="text-[13px] text-slate-500">
              Supported formats: Full edit/view URL, or raw Form ID string.
            </p>

            <Button
              variant="primary"
              onClick={handleDetect}
              disabled={isDetecting || !formUrl.trim()}
              className="w-full"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Detecting Form…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Detect Form
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Step 2 + 3: Mapping ── */}
        {step === 'mapping' && formDetails && (
          <div className="space-y-6">
            {/* Form info */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[15px] text-slate-900 dark:text-white truncate">
                    {formDetails.formTitle}
                  </p>
                  <p className="text-[12px] text-slate-500 font-mono mt-0.5">{formDetails.googleFormId}</p>
                  {formDetails.description && (
                    <p className="text-[13px] text-slate-500 mt-1 line-clamp-2">{formDetails.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-[12px] text-slate-500">
                <span>{formDetails.questions.length} question{formDetails.questions.length !== 1 ? 's' : ''} detected</span>
                <button
                  onClick={() => setStep('url')}
                  className="text-accent hover:underline font-medium"
                >
                  Change form
                </button>
              </div>
            </div>

            {/* Required fields reminder */}
            <div className="flex flex-wrap gap-2">
              {MATTWORK_FIELDS.filter(f => f.required).map(f => {
                const isMapped = usedFields.has(f.value);
                return (
                  <span
                    key={f.value}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all',
                      isMapped
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
                    )}
                  >
                    {isMapped ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {f.label} required
                  </span>
                );
              })}
            </div>

            {/* Global validation errors */}
            {globalErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 space-y-1">
                {globalErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <p className="text-[12px] text-rose-700 dark:text-rose-400">{err}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Questions mapping */}
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-450">
                Map Questions → Mattwork Fields
              </p>
              {formDetails.questions.map(q => (
                <QuestionMappingRow
                  key={q.googleQuestionId}
                  question={q}
                  selectedField={mappings[q.googleQuestionId] ?? ''}
                  usedFields={usedFields}
                  onChange={handleMappingChange}
                  error={perQuestionErrors[q.googleQuestionId]}
                />
              ))}
              {formDetails.questions.length === 0 && (
                <p className="text-[14px] text-slate-500 text-center py-8">
                  No mappable questions found in this form.
                </p>
              )}
            </div>

            {/* Save error */}
            {saveError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-700 dark:text-rose-400">{saveError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        {step === 'mapping' && (
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save &amp; Activate
              </>
            )}
          </Button>
        )}
      </div>
    </Drawer>
  );
}

// ─── Forms Table ──────────────────────────────────────────────────────────────

function FormsTable({
  forms,
  onRenewWatch,
  renewingFormId,
  onSyncNow,
  syncingFormId,
}: {
  forms: ConnectedForm[];
  onRenewWatch: (id: string) => void;
  renewingFormId: string | null;
  onSyncNow: (id: string) => void;
  syncingFormId: string | null;
}) {
  return (
    <div className="flat-card bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Form Name</th>
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Google Form ID</th>
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Status</th>
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Last Successful Sync</th>
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Watch Expiry</th>
              <th className="text-left px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Connected By</th>
              <th className="text-right px-4 py-3.5 font-bold text-[12px] uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {forms.map(form => {
              const latestWatch = form.watches[0] ?? null;
              const watchExpiry = latestWatch ? new Date(latestWatch.expireTime) : null;
              const isExpiringSoon = watchExpiry
                ? watchExpiry.getTime() - Date.now() < 24 * 60 * 60 * 1000
                : false;

              const isRenewing = renewingFormId === form.id;
              const isSyncing = syncingFormId === form.id;

              return (
                <tr
                  key={form.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                >
                  {/* Form name */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-[14px]">
                          {form.formTitle}
                        </p>
                        <p className="text-[12px] text-slate-400">
                          {form._count.processedResponses} response{form._count.processedResponses !== 1 ? 's' : ''} processed
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Form ID */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                        {form.googleFormId}
                      </span>
                      <a
                        href={`https://docs.google.com/forms/d/${form.googleFormId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-accent transition-colors"
                        title="Open in Google Forms"
                        aria-label="Open form in Google Forms"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <SyncStatusBadge status={form.syncStatus} />
                  </td>

                  {/* Last Sync */}
                  <td className="px-4 py-4 text-[13px] text-slate-500">
                    {form.lastSyncedAt ? (
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(form.lastSyncedAt)}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(form.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>

                  {/* Watch Expiry */}
                  <td className="px-4 py-4">
                    {watchExpiry ? (
                      <span className={cn(
                        'text-[13px] font-medium',
                        isExpiringSoon
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500'
                      )}>
                        {watchExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-[13px] text-slate-400">No watch</span>
                    )}
                  </td>

                  {/* Connected by */}
                  <td className="px-4 py-4">
                    <p className="text-[13px] text-slate-700 dark:text-slate-300">{form.connectedByAdmin.name}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(form.createdAt)}</p>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`https://docs.google.com/forms/d/${form.googleFormId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        aria-label="View form"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </a>
                      <button
                        onClick={() => onSyncNow(form.id)}
                        disabled={isSyncing}
                        title="Sync latest responses now"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50 cursor-pointer"
                        aria-label="Sync now"
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sync Now
                      </button>
                      <button
                        onClick={() => onRenewWatch(form.id)}
                        disabled={isRenewing}
                        title="Renew Google Forms Watch"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50 cursor-pointer"
                        aria-label="Renew watch"
                      >
                        {isRenewing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        Renew Watch
                      </button>
                      <button
                        disabled
                        title="Disconnect (coming soon)"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-rose-400 border border-rose-200/50 dark:border-rose-900/50 rounded-lg opacity-50 cursor-not-allowed"
                        aria-label="Disconnect form (coming soon)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3.5 rounded-xl shadow-2xl border border-slate-800 dark:border-slate-200 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <CheckCircle2 className="h-5 w-5 text-emerald-400 dark:text-emerald-600 shrink-0" />
      <span className="text-[14px] font-semibold">{message}</span>
      <button onClick={onDismiss} className="ml-2 text-slate-400 dark:text-slate-600 hover:text-white dark:hover:text-slate-900 transition-colors" aria-label="Dismiss toast">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormsManagerPage() {
  const user = useAuthStore(state => state.user);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: forms, isLoading, error } = useQuery({
    queryKey: ['connected-forms'],
    queryFn: fetchConnectedForms,
    staleTime: 30_000,
    enabled: user?.role === 'ADMIN',
  });

  const renewWatchMutation = useMutation({
    mutationFn: (id: string) => renewFormWatch(id),
    onMutate: (id) => setRenewingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-forms'] });
      setSuccessMessage('Google Forms watch renewed successfully.');
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to renew watch. Please try again.');
    },
    onSettled: () => setRenewingId(null),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => syncFormResponses(id),
    onMutate: (id) => setSyncingId(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['connected-forms'] });
      if (result.created > 0) {
        setSuccessMessage(`${result.created} new project(s) imported.`);
      } else {
        setSuccessMessage('No new responses found.');
      }
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Manual sync failed. Please try again.');
    },
    onSettled: () => setSyncingId(null),
  });

  // Admin guard
  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-[20px] font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-500">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            Forms Manager
          </h1>
          <p className="text-[16px] text-slate-500 mt-1">
            Connect Google Forms to automatically create Mattwork projects.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsConnectOpen(true)}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Connect New Form
        </Button>
      </div>

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="flat-card bg-card border border-border overflow-hidden">
          <div className="animate-pulse">
            <div className="h-12 bg-slate-100 dark:bg-slate-900" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-t border-slate-100 dark:border-slate-800">
                <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-900 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-3 w-24 bg-slate-100 dark:bg-slate-900 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && !isLoading && (
        <div className="flat-card p-6 border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-200 text-[15px]">Failed to load connected forms</p>
              <p className="text-[13px] text-rose-600 dark:text-rose-400 mt-1">
                {(error as any)?.message || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {!isLoading && !error && (
        <>
          {forms && forms.length > 0 ? (
            <FormsTable
              forms={forms}
              onRenewWatch={(id) => renewWatchMutation.mutate(id)}
              renewingFormId={renewingId}
              onSyncNow={(id) => syncMutation.mutate(id)}
              syncingFormId={syncingId}
            />
          ) : (
            <div className="flat-card bg-card border border-border">
              <EmptyState onConnect={() => setIsConnectOpen(true)} />
            </div>
          )}
        </>
      )}

      {/* ── Connect Drawer ── */}
      <ConnectFormDrawer
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setSuccessMessage('Google Form connected successfully.')}
      />

      {/* ── Success Toast ── */}
      {successMessage && (
        <SuccessToast message={successMessage} onDismiss={() => setSuccessMessage('')} />
      )}
    </div>
  );
}
