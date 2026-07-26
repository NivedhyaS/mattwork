'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
  Copy,
  Check,
  MoreVertical,
  ChevronLeft,
  Database,
  Filter,
  SlidersHorizontal,
  Activity,
  User,
  ArrowUpDown,
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
import { cn } from '@/lib/utils';
import Button from '@/components/ui/button';
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

// ─── Relative Time Helper ─────────────────────────────────────────────────────

function formatRelativeTime(dateStr?: string | Date | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Unified Status & Watch Badge Component ───────────────────────────────────

function SyncStatusBadge({ status, watchExpiry }: { status: FormSyncStatus; watchExpiry: Date | null }) {
  const isExpiringSoon = watchExpiry
    ? watchExpiry.getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false;

  if (status === 'ACTIVE' && (!watchExpiry || !isExpiringSoon)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F6EFE9] text-[#10B981] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shrink-0 animate-pulse" />
        Active (Live)
      </span>
    );
  }

  if (status === 'WATCH_EXPIRING' || (status === 'ACTIVE' && isExpiringSoon)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F6EFE9] text-[#EA580C] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
        <Clock className="h-3 w-3 text-[#EA580C]" />
        Expiring Soon
      </span>
    );
  }

  if (status === 'WATCH_EXPIRED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F6EFE9] text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
        <XCircle className="h-3 w-3 text-[#EF4444]" />
        Watch Expired
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F6EFE9] text-[#8C7769] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
      <AlertTriangle className="h-3 w-3 text-[#8C7769]" />
      Never Connected
    </span>
  );
}

// ─── Polished Empty State ──────────────────────────────────────────────────────

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-[#F6EFE9] rounded-3xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-xl mx-auto my-6">
      <div className="h-16 w-16 rounded-full bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-[#EA580C]" />
      </div>
      <h3 className="text-[20px] font-extrabold text-[#3D2E24] mb-1.5">No Google Forms connected yet</h3>
      <p className="text-[14px] text-[#7C6A5A] mb-6 max-w-md font-medium">
        Connect a Google Form to automatically create and log Mattwork video production projects whenever client submissions arrive.
      </p>
      <Button
        onClick={onConnect}
        className="bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[14px] px-6 py-2.5 rounded-2xl shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_3px_10px_rgba(234,88,12,0.35)] hover:shadow-[-5px_-5px_12px_rgba(255,255,255,0.8),5px_5px_14px_rgba(234,88,12,0.45)] transition-all cursor-pointer border-none"
      >
        <Plus className="h-4 w-4 mr-2" />
        Connect Google Form
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
      'p-3.5 rounded-2xl transition-all bg-[#F6EFE9]',
      error || isDateTypeMismatch
        ? 'shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)]'
        : 'shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(206,187,172,0.5)]'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-extrabold text-[#3D2E24] truncate">
              {question.title}
            </span>
            {question.required && (
              <span className="text-[10px] font-extrabold text-[#EF4444] uppercase tracking-wider shrink-0 bg-[#F6EFE9] px-2 py-0.5 rounded-md shadow-[inset_2px_2px_4px_rgba(239,68,68,0.2)]">Required</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#8C7769] bg-[#F6EFE9] px-2 py-0.5 rounded-lg shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
              {question.googleQuestionType}
            </span>
            <span className="text-[11px] text-[#8C7769] font-mono truncate">
              id: {question.googleQuestionId.slice(0, 12)}…
            </span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-[#8C7769] shrink-0 mt-1" />

        <div className="w-52 shrink-0">
          <select
            value={selectedField}
            onChange={(e) => onChange(question.googleQuestionId, e.target.value as MattworkFormField | 'IGNORE' | '')}
            className="w-full text-[13px] font-extrabold px-3 py-2 rounded-xl border-0 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.6),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
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

      {isDateTypeMismatch && !error && (
        <p className="mt-2 text-[12px] text-[#EF4444] font-extrabold">
          "{fieldDef?.label}" requires a DATE-type question, but this question is "{question.googleQuestionType}".
        </p>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-[#EF4444] font-extrabold">{error}</p>
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
  const lastDetectedUrlRef = React.useRef('');

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

  const handleDetect = useCallback(async (isManual = false) => {
    const url = formUrl.trim();
    if (!url) {
      setDetectError('Please enter a Google Form URL or ID.');
      return;
    }

    if (url.includes('/d/e/')) {
      setDetectError('Please use the Form Edit URL (ends with /edit), not the published responder URL (/e/).');
      return;
    }

    if (!isManual && url === lastDetectedUrlRef.current && detectError) {
      return;
    }

    setDetectError('');
    setIsDetecting(true);
    lastDetectedUrlRef.current = url;

    try {
      const details = await previewForm(url);
      setFormDetails(details);
      const initial: Record<string, MattworkFormField | 'IGNORE' | ''> = {};
      details.questions.forEach(q => { initial[q.googleQuestionId] = ''; });
      setMappings(initial);
      setStep('mapping');
    } catch (err: any) {
      setDetectError(err?.response?.data?.message || 'Failed to detect form. Check the URL and try again.');
    } finally {
      setIsDetecting(false);
    }
  }, [formUrl, detectError]);

  React.useEffect(() => {
    const url = formUrl.trim();
    if (!url || step !== 'url' || isDetecting) return;
    if (url === lastDetectedUrlRef.current && detectError) return;

    const hasValidFormat =
      /\/forms\/d\/([a-zA-Z0-9_-]{10,})/.test(url) ||
      /\/d\/([a-zA-Z0-9_-]{10,})/.test(url) ||
      (url.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(url));

    const isResponderUrl = url.includes('/d/e/');

    if (hasValidFormat && !isResponderUrl) {
      const timeoutId = setTimeout(() => {
        handleDetect();
      }, 600);
      return () => clearTimeout(timeoutId);
    }
  }, [formUrl, step, isDetecting, handleDetect]);

  const handleMappingChange = (questionId: string, field: MattworkFormField | 'IGNORE' | '') => {
    setMappings(prev => ({ ...prev, [questionId]: field }));
    setSaveError('');
  };

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

    for (const required of REQUIRED_FIELDS) {
      if (!mappedFieldsToQuestion.has(required)) {
        const fieldLabel = MATTWORK_FIELDS.find(f => f.value === required)?.label;
        errors['__required__' + required] = `"${fieldLabel}" is required and must be mapped.`;
      }
    }

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
          ? 'Paste a Google Form URL to detect questions and map fields.'
          : 'Map each Google Form question to a Mattwork project field.'
      }
      size="lg"
    >
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#F6EFE9]">
        {step === 'url' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="form-url" className="text-[13px] font-extrabold text-[#8C7769]">Google Form URL or Form ID</Label>
              <input
                id="form-url"
                placeholder="https://docs.google.com/forms/d/..."
                value={formUrl}
                onChange={(e) => { setFormUrl(e.target.value); setDetectError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDetect(true); }}
                className="w-full text-[14px] font-mono px-4 py-3 bg-[#F6EFE9] text-[#3D2E24] border-0 rounded-2xl shadow-[inset_4px_4px_8px_rgba(206,187,172,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.85)] focus:outline-none"
                disabled={isDetecting}
              />
              {detectError && (
                <div className="space-y-3 p-4 rounded-2xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#EF4444] shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[#EF4444] font-extrabold">{detectError}</p>
                  </div>

                  {(detectError.includes('permission') || detectError.includes('caller')) && (
                    <div className="pt-3 border-t border-[rgba(239,68,68,0.2)] text-[12.5px] text-[#3D2E24] space-y-2">
                      <p className="font-extrabold text-[#EA580C] flex items-center gap-1.5">
                        <span>💡 How to fix this in 30 seconds:</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 font-semibold text-[#7C6A5A] leading-relaxed">
                        <li>Open your Google Form in your browser.</li>
                        <li>Click <strong className="text-[#3D2E24]">⋮ (Add collaborators)</strong> in the top right.</li>
                        <li>Add the app&apos;s Service Account Email below as an <strong className="text-[#3D2E24]">Editor</strong>:</li>
                      </ol>
                      <div className="flex items-center gap-2 mt-2 p-2.5 rounded-xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                        <code className="text-[11.5px] font-mono text-[#3D2E24] font-extrabold truncate flex-1 select-all">
                          mattwork-service@mattwork-501419.iam.gserviceaccount.com
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('mattwork-service@mattwork-501419.iam.gserviceaccount.com');
                            alert('Service account email copied to clipboard!');
                          }}
                          className="px-3 py-1.5 text-[11px] font-extrabold bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white rounded-xl shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_5px_rgba(234,88,12,0.4)] shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                        >
                          Copy Email
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-[13px] text-[#7C6A5A] font-extrabold">
              Supported formats: Full edit/view URL, or raw Form ID string.
            </p>

            <Button
              onClick={() => handleDetect(true)}
              disabled={isDetecting || !formUrl.trim()}
              className="w-full bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[15px] py-3.5 rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.7),4px_4px_12px_rgba(234,88,12,0.4)]"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
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

        {step === 'mapping' && formDetails && (
          <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-[#F6EFE9] shadow-[-6px_-6px_12px_rgba(255,255,255,0.9),6px_6px_12px_rgba(206,187,172,0.6)]">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-[#EA580C]" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-[16px] text-[#3D2E24] truncate">
                    {formDetails.formTitle}
                  </p>
                  <p className="text-[12px] text-[#8C7769] font-mono mt-0.5">{formDetails.googleFormId}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[rgba(206,187,172,0.3)] flex items-center gap-4 text-[12px] text-[#7C6A5A] font-extrabold">
                <span>{formDetails.questions.length} questions detected</span>
                <button
                  onClick={() => setStep('url')}
                  className="text-[#EA580C] hover:underline font-extrabold cursor-pointer"
                >
                  Change form
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {MATTWORK_FIELDS.filter(f => f.required).map(f => {
                const isMapped = usedFields.has(f.value);
                return (
                  <span
                    key={f.value}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-[#F6EFE9]',
                      isMapped
                        ? 'text-[#10B981] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]'
                        : 'text-[#EF4444] shadow-[inset_2px_2px_4px_rgba(239,68,68,0.25)]'
                    )}
                  >
                    {isMapped ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {f.label} required
                  </span>
                );
              })}
            </div>

            {globalErrors.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)] space-y-1">
                {globalErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444] shrink-0" />
                    <p className="text-[12px] text-[#EF4444] font-extrabold">{err}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#8C7769]">
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
            </div>

            {saveError && (
              <div className="flex items-start gap-2 p-4 rounded-2xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)]">
                <AlertTriangle className="h-4 w-4 text-[#EF4444] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#EF4444] font-extrabold">{saveError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-[rgba(206,187,172,0.3)] bg-[#F6EFE9] flex items-center justify-between gap-3">
        <button
          onClick={handleClose}
          className="px-5 py-2.5 rounded-2xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] font-extrabold text-[14px]"
        >
          Cancel
        </button>
        {step === 'mapping' && (
          <button
            onClick={handleSave}
            disabled={!isValid || saveMutation.isPending}
            className="bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[14px] px-6 py-2.5 rounded-2xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.7),4px_4px_12px_rgba(234,88,12,0.4)] disabled:opacity-50 flex items-center"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-white" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save &amp; Activate
              </>
            )}
          </button>
        )}
      </div>
    </Drawer>
  );
}

// ─── Compact Refined Table Row Component ──────────────────────────────────────

function FormTableRow({
  form,
  onRenewWatch,
  renewingFormId,
  onSyncNow,
  syncingFormId,
  onOpenConnectModal,
}: {
  form: ConnectedForm;
  onRenewWatch: (id: string) => void;
  renewingFormId: string | null;
  onSyncNow: (id: string) => void;
  syncingFormId: string | null;
  onOpenConnectModal: () => void;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isSyncing = syncingFormId === form.id;
  const latestWatch = form.watches[0] ?? null;
  const watchExpiry = latestWatch ? new Date(latestWatch.expireTime) : null;

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(form.googleFormId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const shortFormId = form.googleFormId.length > 10
    ? `${form.googleFormId.slice(0, 5)}…${form.googleFormId.slice(-3)}`
    : form.googleFormId;

  // Primary Client Identifier
  const clientName = form.connectedByAdmin.name || 'Client Intake Form';

  return (
    <tr className="hover:bg-[rgba(234,88,12,0.04)] transition-all group">
      {/* 1. Client Name (Primary) & Form Name (Secondary) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <User className="h-4.5 w-4.5 text-[#EA580C]" />
          </div>
          <div>
            <h4 className="font-extrabold text-[#3D2E24] text-[15px] leading-snug group-hover:text-[#EA580C] transition-colors">
              {clientName}
            </h4>
            <p className="text-[12px] text-[#8C7769] font-medium flex items-center gap-1">
              <FileText className="h-3 w-3 text-[#EA580C] shrink-0" />
              {form.formTitle}
            </p>
          </div>
        </div>
      </td>

      {/* 2. Google Form ID + Copy/Open */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono font-extrabold text-[#3D2E24] bg-[#F6EFE9] px-2 py-0.5 rounded-lg shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
            {shortFormId}
          </span>
          <button
            onClick={handleCopyId}
            className="p-1 rounded-md bg-[#F6EFE9] text-[#7C6A5A] hover:text-[#EA580C] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(206,187,172,0.4)] transition-all cursor-pointer"
            title="Copy Form ID"
          >
            {copiedId ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3" />}
          </button>
          <a
            href={`https://docs.google.com/forms/d/${form.googleFormId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-md bg-[#F6EFE9] text-[#7C6A5A] hover:text-[#EA580C] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(206,187,172,0.4)] transition-all cursor-pointer"
            title="Open in Google Forms"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </td>

      {/* 3. Status Column (Merged Sync & Watch Status) */}
      <td className="px-4 py-3">
        <SyncStatusBadge status={form.syncStatus} watchExpiry={watchExpiry} />
      </td>

      {/* 4. Compact Response Badge */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
          <Database className="h-3 w-3 text-[#EA580C]" />
          {form._count.processedResponses}
        </span>
      </td>

      {/* 5. Last Sync Relative Time + Exact Timestamp */}
      <td className="px-4 py-3">
        {form.lastSyncedAt ? (
          <div>
            <p className="font-extrabold text-[13px] text-[#3D2E24]">
              {formatRelativeTime(form.lastSyncedAt)}
            </p>
            <p className="text-[10px] text-[#8C7769] font-medium">
              {new Date(form.lastSyncedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ) : (
          <span className="text-[12px] text-[#8C7769] font-medium">Never</span>
        )}
      </td>

      {/* 6. Simplified Connected By Column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.4)] flex items-center justify-center font-extrabold text-[10px] text-[#EA580C]">
            {form.connectedByAdmin.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[12px] font-extrabold text-[#3D2E24]">{form.connectedByAdmin.name}</span>
        </div>
      </td>

      {/* 7. Simplified Actions Column */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5 relative">
          <a
            href={`https://docs.google.com/forms/d/${form.googleFormId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-xl bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[12px] shadow-[-2px_-2px_5px_rgba(255,255,255,0.7),2px_2px_6px_rgba(234,88,12,0.3)] transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>

          <button
            onClick={() => onSyncNow(form.id)}
            disabled={isSyncing}
            className="p-1.5 rounded-xl bg-[#F6EFE9] text-[#3D2E24] font-extrabold text-[12px] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] hover:text-[#EA580C] transition-all cursor-pointer inline-flex items-center disabled:opacity-50"
            title="Sync latest responses"
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EA580C]" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] hover:text-[#EA580C] transition-all cursor-pointer"
              title="More Options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#F6EFE9] rounded-2xl shadow-[-6px_-6px_14px_rgba(255,255,255,0.95),6px_6px_14px_rgba(201,180,163,0.75)] p-1.5 z-30 space-y-1">
                  <button
                    onClick={() => { onRenewWatch(form.id); setIsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] font-extrabold text-[#3D2E24] rounded-xl hover:bg-[rgba(234,88,12,0.08)] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5 text-[#EA580C]" />
                    Renew Watch
                  </button>
                  <button
                    onClick={(e) => { handleCopyId(e); setIsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] font-extrabold text-[#3D2E24] rounded-xl hover:bg-[rgba(234,88,12,0.08)] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-[#7C6A5A]" />
                    Copy Form ID
                  </button>
                  <button
                    onClick={() => { onOpenConnectModal(); setIsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] font-extrabold text-[#3D2E24] rounded-xl hover:bg-[rgba(234,88,12,0.08)] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#7C6A5A]" />
                    Remap Fields
                  </button>
                  <button
                    onClick={() => { alert('Form disconnection feature configured via Admin dashboard settings.'); setIsMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] font-extrabold text-[#EF4444] rounded-xl hover:bg-[rgba(239,68,68,0.08)] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" />
                    Disconnect Form
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function SuccessToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#F6EFE9] text-[#3D2E24] px-5 py-3.5 rounded-2xl shadow-[-6px_-6px_12px_rgba(255,255,255,0.95),6px_6px_12px_rgba(206,187,172,0.7)] border-0">
      <CheckCircle2 className="h-5 w-5 text-[#10B981] shrink-0" />
      <span className="text-[14px] font-extrabold">{message}</span>
      <button onClick={onDismiss} className="ml-2 text-[#8C7769] hover:text-[#3D2E24] transition-colors" aria-label="Dismiss toast">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Main Forms Manager Page Component ────────────────────────────────────────

export default function FormsManagerPage() {
  const user = useAuthStore(state => state.user);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [adminFilter, setAdminFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'responses'>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Summary Metrics Computation
  const summary = useMemo(() => {
    if (!forms) return { totalForms: 0, activeWatches: 0, totalResponses: 0, lastSyncTime: null };
    const totalForms = forms.length;
    const activeWatches = forms.filter(f => f.syncStatus === 'ACTIVE').length;
    const totalResponses = forms.reduce((acc, f) => acc + (f._count?.processedResponses || 0), 0);

    const syncDates = forms.map(f => f.lastSyncedAt ? new Date(f.lastSyncedAt).getTime() : 0);
    const maxSync = Math.max(...syncDates, 0);
    const lastSyncTime = maxSync > 0 ? new Date(maxSync) : null;

    return { totalForms, activeWatches, totalResponses, lastSyncTime };
  }, [forms]);

  const connectedAdminsList = useMemo(() => {
    if (!forms) return [];
    const names = new Set<string>();
    forms.forEach(f => {
      if (f.connectedByAdmin?.name) names.add(f.connectedByAdmin.name);
    });
    return Array.from(names);
  }, [forms]);

  const filteredForms = useMemo(() => {
    if (!forms) return [];
    return forms
      .filter((form) => {
        const query = search.toLowerCase();
        const matchesSearch = !query ||
          form.formTitle.toLowerCase().includes(query) ||
          form.googleFormId.toLowerCase().includes(query) ||
          (form.connectedByAdmin?.name && form.connectedByAdmin.name.toLowerCase().includes(query));

        const matchesStatus = statusFilter === 'ALL' || form.syncStatus === statusFilter;
        const matchesAdmin = adminFilter === 'ALL' || form.connectedByAdmin?.name === adminFilter;

        return matchesSearch && matchesStatus && matchesAdmin;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'title') return a.formTitle.localeCompare(b.formTitle);
        if (sortBy === 'responses') return (b._count?.processedResponses || 0) - (a._count?.processedResponses || 0);
        return 0;
      });
  }, [forms, search, statusFilter, adminFilter, sortBy]);

  const totalPages = Math.ceil(filteredForms.length / itemsPerPage) || 1;
  const paginatedForms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredForms.slice(start, start + itemsPerPage);
  }, [filteredForms, currentPage, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, adminFilter, sortBy]);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#F6EFE9]">
        <div className="text-center p-8 rounded-3xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] max-w-md">
          <AlertTriangle className="h-12 w-12 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-[22px] font-extrabold text-[#3D2E24] mb-2">Access Denied</h2>
          <p className="text-[#7C6A5A] font-medium">You do not have permission to access the Forms Manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[100%] w-full mx-auto pb-12">
      {/* ── 1. Header Section ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[36px] font-extrabold tracking-tight text-[#3D2E24] leading-tight">
            Forms Manager
          </h1>
          <p className="text-[15px] text-[#7C6A5A] mt-1 font-extrabold">
            Connect Google Forms to automatically log production video projects into Mattwork.
          </p>
        </div>
        <button
          onClick={() => setIsConnectOpen(true)}
          className="shrink-0 bg-gradient-to-br from-[#FF8A3D] to-[#EA580C] text-white font-extrabold text-[14px] px-5 py-2.5 rounded-2xl shadow-[-3px_-3px_8px_rgba(255,255,255,0.7),3px_3px_10px_rgba(234,88,12,0.35)] hover:shadow-[-5px_-5px_12px_rgba(255,255,255,0.8),5px_5px_14px_rgba(234,88,12,0.45)] transition-all cursor-pointer flex items-center border-none"
        >
          <Plus className="h-4.5 w-4.5 mr-2" />
          Connect New Form
        </button>
      </div>

      {/* ── 2. Summary Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#F6EFE9] p-5 rounded-3xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] flex items-center justify-between">
          <div>
            <p className="text-[12px] font-extrabold text-[#7C6A5A] uppercase tracking-wider">Connected Forms</p>
            <p className="text-[28px] font-black text-[#3D2E24] leading-tight mt-0.5">{summary.totalForms}</p>
            <p className="text-[11px] text-[#8C7769] font-medium mt-0.5">Active form integrations</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-[#EA580C]" />
          </div>
        </div>

        <div className="bg-[#F6EFE9] p-5 rounded-3xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] flex items-center justify-between">
          <div>
            <p className="text-[12px] font-extrabold text-[#7C6A5A] uppercase tracking-wider">Active Watches</p>
            <p className="text-[28px] font-black text-[#3D2E24] leading-tight mt-0.5">{summary.activeWatches}</p>
            <p className="text-[11px] text-[#8C7769] font-medium mt-0.5">Google webhooks live</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-[#10B981]" />
          </div>
        </div>

        <div className="bg-[#F6EFE9] p-5 rounded-3xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] flex items-center justify-between">
          <div>
            <p className="text-[12px] font-extrabold text-[#7C6A5A] uppercase tracking-wider">Total Responses</p>
            <p className="text-[28px] font-black text-[#3D2E24] leading-tight mt-0.5">{summary.totalResponses}</p>
            <p className="text-[11px] text-[#8C7769] font-medium mt-0.5">Auto-generated projects</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <Database className="h-5 w-5 text-[#EA580C]" />
          </div>
        </div>

        <div className="bg-[#F6EFE9] p-5 rounded-3xl shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(206,187,172,0.6)] flex items-center justify-between">
          <div>
            <p className="text-[12px] font-extrabold text-[#7C6A5A] uppercase tracking-wider">Last Sync</p>
            <p className="text-[18px] font-black text-[#3D2E24] leading-tight mt-0.5 truncate max-w-[140px]">
              {formatRelativeTime(summary.lastSyncTime)}
            </p>
            <p className="text-[10px] text-[#8C7769] font-medium mt-0.5 truncate max-w-[140px]">
              {summary.lastSyncTime ? summary.lastSyncTime.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No sync recorded'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center shrink-0">
            <RefreshCw className="h-5 w-5 text-[#EA580C]" />
          </div>
        </div>
      </div>

      {/* ── 3. Search & Filter Controls Bar ── */}
      <div className="flex flex-col md:flex-row gap-3 pt-1">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7769]" />
          <input
            type="text"
            placeholder="Search client, form name, or Form ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-2xl border-0 bg-[#F6EFE9] text-[#3D2E24] font-semibold placeholder:text-[#8C7769] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#8C7769] shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[13px] font-extrabold border-0 rounded-2xl px-3.5 py-2.5 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="WATCH_EXPIRING">Expiring Soon</option>
            <option value="WATCH_EXPIRED">Expired</option>
            <option value="ERROR">Never Connected</option>
          </select>
        </div>

        {connectedAdminsList.length > 0 && (
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#8C7769] shrink-0" />
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="text-[13px] font-extrabold border-0 rounded-2xl px-3.5 py-2.5 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Connected By (All)</option>
              {connectedAdminsList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-[#8C7769] shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-[13px] font-extrabold border-0 rounded-2xl px-3.5 py-2.5 bg-[#F6EFE9] text-[#3D2E24] shadow-[inset_3px_3px_6px_rgba(206,187,172,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest Connected</option>
            <option value="oldest">Oldest Connected</option>
            <option value="title">Client Name (A-Z)</option>
            <option value="responses">Most Responses</option>
          </select>
        </div>
      </div>

      {/* ── 4. Main Refined Full-Width Table ── */}
      {isLoading ? (
        <div className="bg-[#F6EFE9] rounded-3xl p-6 shadow-[inset_2px_2px_5px_rgba(206,187,172,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-[#F6EFE9] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-[#F6EFE9] shadow-[inset_3px_3px_6px_rgba(239,68,68,0.3)] text-center space-y-2">
          <AlertTriangle className="h-7 w-7 text-[#EF4444] mx-auto" />
          <p className="font-extrabold text-[#EF4444] text-[15px]">Failed to load connected forms</p>
          <p className="text-[12px] text-[#7C6A5A]">{(error as any)?.message || 'Unexpected server error.'}</p>
        </div>
      ) : filteredForms.length === 0 ? (
        forms && forms.length === 0 ? (
          <EmptyState onConnect={() => setIsConnectOpen(true)} />
        ) : (
          <div className="text-center py-12 px-6 bg-[#F6EFE9] rounded-3xl shadow-[inset_3px_3px_6px_rgba(206,187,172,0.4),inset_-3px_-3px_6px_rgba(255,255,255,0.85)]">
            <Search className="h-8 w-8 text-[#EA580C] mx-auto mb-2" />
            <h4 className="text-[16px] font-extrabold text-[#3D2E24]">No forms match active filters</h4>
            <p className="text-[13px] text-[#7C6A5A] mt-1 mb-3">Try clearing search terms or adjusting filter dropdowns.</p>
            <button
              onClick={() => { setSearch(''); setStatusFilter('ALL'); setAdminFilter('ALL'); }}
              className="px-4 py-2 rounded-2xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] font-extrabold text-[12px] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )
      ) : (
        <div className="bg-[#F6EFE9] rounded-3xl shadow-[inset_2px_2px_5px_rgba(206,187,172,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.85)] p-1.5 overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[rgba(206,187,172,0.3)] bg-[#F6EFE9]">
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Client & Form</th>
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Form ID</th>
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Status</th>
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Responses</th>
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Last Sync</th>
                  <th className="text-left px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Connected By</th>
                  <th className="text-right px-4 py-3 font-extrabold text-[11px] uppercase tracking-wider text-[#8C7769]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(206,187,172,0.2)]">
                {paginatedForms.map((form) => (
                  <FormTableRow
                    key={form.id}
                    form={form}
                    onRenewWatch={(id) => renewWatchMutation.mutate(id)}
                    renewingFormId={renewingId}
                    onSyncNow={(id) => syncMutation.mutate(id)}
                    syncingFormId={syncingId}
                    onOpenConnectModal={() => setIsConnectOpen(true)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ── */}
          <div className="px-5 py-3 border-t border-[rgba(206,187,172,0.3)] bg-[#F6EFE9] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-[#7C6A5A] font-extrabold">
              Showing <span className="text-[#3D2E24]">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-[#3D2E24]">{Math.min(currentPage * itemsPerPage, filteredForms.length)}</span> of <span className="text-[#3D2E24]">{filteredForms.length}</span> connected forms
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] disabled:opacity-40 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-extrabold text-[#3D2E24] px-3 py-0.5 rounded-xl bg-[#F6EFE9] shadow-[inset_2px_2px_4px_rgba(206,187,172,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl bg-[#F6EFE9] text-[#3D2E24] shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(206,187,172,0.5)] disabled:opacity-40 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Connect Form Drawer ── */}
      <ConnectFormDrawer
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onSuccess={() => setSuccessMessage('Google Form connected successfully.')}
      />

      {/* ── 6. Success Toast ── */}
      {successMessage && (
        <SuccessToast message={successMessage} onDismiss={() => setSuccessMessage('')} />
      )}
    </div>
  );
}
