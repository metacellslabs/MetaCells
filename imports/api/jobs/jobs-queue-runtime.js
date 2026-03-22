import { Meteor } from 'meteor/meteor';

export async function enqueueDurableJobRuntime(deps, options) {
  const {
    Jobs,
    JOB_STATUS,
    jobPayloadMatch,
    nowDate,
    ensureHandler,
    getHandlerMaxAttempts,
    getHandlerRetryDelayMs,
    getHandlerTimeoutMs,
    getHandlerLeaseTimeoutMs,
    getHandlerHeartbeatIntervalMs,
    getJobHandlerMetadata,
    appendJobLog,
    scheduleDrain,
    check,
  } = deps;
  const {
    type,
    payload,
    dedupeKey = '',
    priority = 0,
    maxAttempts,
    retryDelayMs,
    runAt = null,
    timeoutMs,
    leaseTimeoutMs,
    heartbeatIntervalMs,
  } = options || {};

  const normalizedType = String(type || '').trim();
  if (!normalizedType) throw new Error('enqueueDurableJob requires a type');
  const handler = ensureHandler(normalizedType);

  const normalizedPayload = payload || {};
  check(normalizedPayload, handler.payloadSchema || jobPayloadMatch);

  const normalizedDedupeKey = String(dedupeKey || '').trim();
  if (normalizedDedupeKey) {
    const existing = await Jobs.findOneAsync({
      type: normalizedType,
      dedupeKey: normalizedDedupeKey,
      status: {
        $in: [
          JOB_STATUS.QUEUED,
          JOB_STATUS.LEASED,
          JOB_STATUS.RUNNING,
          JOB_STATUS.RETRYING,
        ],
      },
    });
    if (existing) {
      await appendJobLog(existing, 'dedupe_hit', {
        dedupeKey: normalizedDedupeKey,
      });
      return existing;
    }
  }

  const createdAt = nowDate();
  const jobDoc = {
    type: normalizedType,
    payload: normalizedPayload,
    dedupeKey: normalizedDedupeKey,
    status: JOB_STATUS.QUEUED,
    attempts: 0,
    maxAttempts: Math.max(
      1,
      parseInt(maxAttempts, 10) || getHandlerMaxAttempts(normalizedType),
    ),
    retryDelayMs: Math.max(
      250,
      parseInt(retryDelayMs, 10) || getHandlerRetryDelayMs(normalizedType),
    ),
    timeoutMs: Math.max(
      1_000,
      parseInt(timeoutMs, 10) || getHandlerTimeoutMs(normalizedType),
    ),
    leaseTimeoutMs: Math.max(
      1_000,
      parseInt(leaseTimeoutMs, 10) || getHandlerLeaseTimeoutMs(normalizedType),
    ),
    heartbeatIntervalMs: Math.max(
      500,
      parseInt(heartbeatIntervalMs, 10) ||
        getHandlerHeartbeatIntervalMs(normalizedType),
    ),
    priority: parseInt(priority, 10) || 0,
    runAt: runAt instanceof Date ? runAt : createdAt,
    createdAt,
    updatedAt: createdAt,
    leasedAt: null,
    startedAt: null,
    completedAt: null,
    heartbeatAt: null,
    lockUntil: null,
    lockToken: '',
    lastError: '',
    result: null,
    handlerMeta: getJobHandlerMetadata(normalizedType),
  };

  const jobId = await Jobs.insertAsync(jobDoc);
  const job = await Jobs.findOneAsync(jobId);
  await appendJobLog(job, 'queued', {
    dedupeKey: normalizedDedupeKey,
    runAt: job && job.runAt,
  });
  scheduleDrain(normalizedType);
  return job;
}

export async function waitForJobResultRuntime(deps, jobId, options = {}) {
  const { Jobs, JOB_STATUS, DEFAULT_WAIT_TIMEOUT_MS, DEFAULT_POLL_INTERVAL_MS } =
    deps;
  const timeoutMs = Math.max(
    1_000,
    parseInt(options.timeoutMs, 10) || DEFAULT_WAIT_TIMEOUT_MS,
  );
  const pollIntervalMs = Math.max(
    50,
    parseInt(options.pollIntervalMs, 10) || DEFAULT_POLL_INTERVAL_MS,
  );
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await Jobs.findOneAsync(jobId, {
      fields: {
        status: 1,
        result: 1,
        lastError: 1,
      },
    });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    if (job.status === JOB_STATUS.COMPLETED) {
      return job.result;
    }
    if (job.status === JOB_STATUS.FAILED) {
      throw new Error(String(job.lastError || 'Job failed'));
    }
    if (job.status === JOB_STATUS.CANCELLED) {
      throw new Error(String(job.lastError || 'Job cancelled'));
    }
    await new Promise((resolve) => Meteor.setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

export async function enqueueDurableJobAndWaitRuntime(
  deps,
  options = {},
  waitOptions = {},
) {
  const job = await enqueueDurableJobRuntime(deps, options);
  return waitForJobResultRuntime(deps, job && job._id, waitOptions);
}
