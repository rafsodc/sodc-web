import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'coverage/**',
        'lib/**',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/dataconnect-admin-generated/**',
        'src/generatedEmailTemplateManifest.ts',
      ],
      thresholds: {
        statements: 46,
        branches: 42,
        functions: 57,
        lines: 46,
        'src/{helpers,rateLimiter,sections,validation}.ts': {
          statements: 77,
          branches: 66,
          functions: 80,
          lines: 77,
        },
        'src/{bookingCheckout,bookingPaymentAdjustments,paymentReconciliation,paymentStateMachine,paymentTransitionEngine,stripeWebhookRouting}.ts': {
          statements: 90,
          branches: 73,
          functions: 100,
          lines: 94,
        },
        'src/{mailer,mailerErrors,notificationDelivery,notifyCallback}.ts': {
          statements: 81,
          branches: 68,
          functions: 69,
          lines: 82,
        },
        'src/notificationDelivery.ts': {
          statements: 65,
          branches: 50,
          functions: 57,
          lines: 64,
        },
        'src/notifyReceiptProcessor.ts': {
          statements: 87,
          branches: 78,
          functions: 93,
          lines: 91,
        },
        'src/paymentCheckoutCallables.ts': {
          statements: 82,
          branches: 58,
          functions: 100,
          lines: 88,
        },
        'src/paymentOpsInternalAlerts.ts': {
          statements: 88,
          branches: 63,
          functions: 90,
          lines: 87,
        },
        'src/paymentReconciliationCallable.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/paymentReconciliationService.ts': {
          statements: 93,
          branches: 86,
          functions: 70,
          lines: 93,
        },
        'src/paymentWebhook.ts': {
          statements: 85,
          branches: 65,
          functions: 80,
          lines: 85,
        },
      },
    },
  },
});
