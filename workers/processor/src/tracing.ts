import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Logger } from '@nestjs/common';

const logger = new Logger('Tracing');

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

export const otelSDK = new NodeSDK({
  serviceName: 'nexus-worker',
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

otelSDK.start();

process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => logger.log('Tracing terminated'))
    .catch((error) => logger.error('Error terminating tracing', error?.stack || error))
    .finally(() => process.exit(0));
});
