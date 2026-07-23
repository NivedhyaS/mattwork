import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  // Comma-separated list of allowed CORS origins.
  // Example: "http://localhost:3000,https://party-strung-blinker.ngrok-free.dev"
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // Public HTTPS ngrok URL of the backend (port 5000).
  // Example: "https://party-strung-blinker.ngrok-free.dev"
  NGROK_URL: z.string().optional(),
  LOG_LEVEL: z.string().default('debug'),
  GOOGLE_FORMS_WEBHOOK_SECRET: z.string().default('mattwork_default_google_forms_secret_2026'),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  // Set to "true" to use the real Google Drive API. Requires GOOGLE_CLIENT_EMAIL,
  // GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID to be set.
  GOOGLE_DRIVE_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // Google Sheets sync — set to "true" to write project data to a Google Sheet.
  // Requires GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_SHEETS_SPREADSHEET_ID.
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_SHEET_NAME: z.string().default('Projects'),
  GOOGLE_SHEETS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  GOOGLE_PUBSUB_TOPIC: z.string().default('projects/mattwork/topics/mattwork-forms-notifications'),
  // Full URL of the Pub/Sub push endpoint — used as the expected JWT audience
  // Set this to the public HTTPS URL of this server + /api/v1/webhooks/forms-pubsub
  PUBSUB_PUSH_ENDPOINT_URL: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && !data.PUBSUB_PUSH_ENDPOINT_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PUBSUB_PUSH_ENDPOINT_URL'],
      message: 'PUBSUB_PUSH_ENDPOINT_URL is required when NODE_ENV=production to ensure secure Google OIDC JWT audience validation.',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
