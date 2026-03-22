export function resolveHandlerValue(value, type, fallback) {
  if (typeof value === 'function') {
    const resolved = value(type);
    return resolveHandlerValue(resolved, type, fallback);
  }
  const numeric = parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getHandlerRetryPolicy(
  ensureHandler,
  defaults,
  type,
) {
  const handler = ensureHandler(type);
  const policy =
    handler.retryPolicy && typeof handler.retryPolicy === 'object'
      ? handler.retryPolicy
      : {};
  return {
    maxAttempts: Math.max(
      1,
      resolveHandlerValue(
        policy.maxAttempts,
        type,
        resolveHandlerValue(handler.maxAttempts, type, 1),
      ),
    ),
    retryDelayMs: Math.max(
      250,
      resolveHandlerValue(
        policy.retryDelayMs,
        type,
        resolveHandlerValue(
          handler.retryDelayMs,
          type,
          defaults.DEFAULT_RETRY_DELAY_MS,
        ),
      ),
    ),
    backoffMultiplier: Math.max(
      1,
      Number(policy.backoffMultiplier || defaults.DEFAULT_BACKOFF_MULTIPLIER),
    ),
    maxRetryDelayMs: Math.max(
      250,
      resolveHandlerValue(
        policy.maxRetryDelayMs,
        type,
        defaults.DEFAULT_MAX_RETRY_DELAY_MS,
      ),
    ),
  };
}

export function getHandlerConcurrency(ensureHandler, type) {
  const handler = ensureHandler(type);
  return Math.max(1, resolveHandlerValue(handler.concurrency, type, 1));
}

export function getHandlerLeaseTimeoutMs(ensureHandler, defaults, type) {
  const handler = ensureHandler(type);
  return Math.max(
    1_000,
    resolveHandlerValue(
      handler.leaseTimeoutMs,
      type,
      defaults.DEFAULT_LEASE_TIMEOUT_MS,
    ),
  );
}

export function getHandlerHeartbeatIntervalMs(
  ensureHandler,
  defaults,
  getHandlerLeaseTimeoutMsImpl,
  type,
) {
  const handler = ensureHandler(type);
  const requested = Math.max(
    500,
    resolveHandlerValue(
      handler.heartbeatIntervalMs,
      type,
      defaults.DEFAULT_HEARTBEAT_INTERVAL_MS,
    ),
  );
  return Math.min(
    requested,
    Math.max(500, Math.floor(getHandlerLeaseTimeoutMsImpl(type) / 2)),
  );
}

export function getHandlerTimeoutMs(ensureHandler, defaults, type) {
  const handler = ensureHandler(type);
  return Math.max(
    1_000,
    resolveHandlerValue(handler.timeoutMs, type, defaults.DEFAULT_TIMEOUT_MS),
  );
}

export function validateRegisteredHandler(type, options) {
  const normalizedType = String(type || '').trim();
  if (!normalizedType) throw new Error('Job handler requires a type');
  if (!options || typeof options.run !== 'function') {
    throw new Error(
      `Job handler ${normalizedType} must provide a run(job) function`,
    );
  }
  if (!options.payloadSchema) {
    throw new Error(
      `Job handler ${normalizedType} must provide a payloadSchema`,
    );
  }
  if (!options.idempotencyStrategy) {
    throw new Error(
      `Job handler ${normalizedType} must provide an idempotencyStrategy`,
    );
  }
  const timeoutMs = resolveHandlerValue(options.timeoutMs, normalizedType, NaN);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `Job handler ${normalizedType} must provide a positive timeoutMs`,
    );
  }
}

export function getJobHandlerMetadata(
  ensureHandler,
  getHandlerTimeoutMsImpl,
  getHandlerLeaseTimeoutMsImpl,
  getHandlerHeartbeatIntervalMsImpl,
  getHandlerRetryPolicyImpl,
  type,
) {
  const handler = ensureHandler(type);
  return {
    description: String(handler.description || ''),
    payloadSchema: String(handler.payloadSchemaDescription || 'custom'),
    idempotencyStrategy: String(handler.idempotencyStrategy || ''),
    timeoutMs: getHandlerTimeoutMsImpl(type),
    leaseTimeoutMs: getHandlerLeaseTimeoutMsImpl(type),
    heartbeatIntervalMs: getHandlerHeartbeatIntervalMsImpl(type),
    retryPolicy: getHandlerRetryPolicyImpl(type),
  };
}
