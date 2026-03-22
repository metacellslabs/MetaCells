import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import {
  enqueueDurableJobAndWaitRuntime,
  enqueueDurableJobRuntime,
  waitForJobResultRuntime,
} from './jobs-queue-runtime.js';
import {
  getHandlerConcurrency as getHandlerConcurrencyRuntime,
  getHandlerHeartbeatIntervalMs as getHandlerHeartbeatIntervalMsRuntime,
  getHandlerLeaseTimeoutMs as getHandlerLeaseTimeoutMsRuntime,
  getHandlerRetryPolicy as getHandlerRetryPolicyRuntime,
  getHandlerTimeoutMs as getHandlerTimeoutMsRuntime,
  getJobHandlerMetadata as getJobHandlerMetadataRuntime,
  validateRegisteredHandler as validateRegisteredHandlerRuntime,
} from './jobs-handler-runtime.js';

export const Jobs = new Mongo.Collection('jobs');
export const JobLogs = new Mongo.Collection('job_logs');
export const DeadLetterJobs = new Mongo.Collection('dead_letter_jobs');

export const JOB_STATUS = {
  QUEUED: 'queued',
  LEASED: 'leased',
  RUNNING: 'running',
  RETRYING: 'retrying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const DEFAULT_WAIT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_LEASE_TIMEOUT_MS = 60_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_RECOVERY_SWEEP_INTERVAL_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_BACKOFF_MULTIPLIER = 1.75;
const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;
const jobPayloadMatch = Match.Where(
  (value) => !!value && typeof value === 'object' && !Array.isArray(value),
);

const jobHandlers = new Map();
const activeCountsByType = new Map();
const heartbeatTimersByJobId = new Map();
let jobsWorkerStarted = false;
let isWorkerEnabledHook = null;
let recoverySweepTimer = null;

function log(event, payload) {
  console.log(`[jobs] ${event}`, payload);
}

function nowDate() {
  return new Date();
}

function toErrorMessage(error) {
  if (!error) return 'Unknown job error';
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string' && error.message.trim())
    return error.message.trim();
  return String(error);
}

function ensureHandler(type) {
  const handler = jobHandlers.get(String(type || ''));
  if (!handler) {
    throw new Error(`No job handler registered for ${String(type || '')}`);
  }
  return handler;
}

function getHandlerRetryPolicy(type) {
  return getHandlerRetryPolicyRuntime(
    ensureHandler,
    {
      DEFAULT_RETRY_DELAY_MS,
      DEFAULT_BACKOFF_MULTIPLIER,
      DEFAULT_MAX_RETRY_DELAY_MS,
    },
    type,
  );
}

function getHandlerConcurrency(type) {
  return getHandlerConcurrencyRuntime(ensureHandler, type);
}

function getHandlerMaxAttempts(type) {
  return getHandlerRetryPolicy(type).maxAttempts;
}

function getHandlerRetryDelayMs(type) {
  return getHandlerRetryPolicy(type).retryDelayMs;
}

function getHandlerLeaseTimeoutMs(type) {
  return getHandlerLeaseTimeoutMsRuntime(
    ensureHandler,
    { DEFAULT_LEASE_TIMEOUT_MS },
    type,
  );
}

function getHandlerHeartbeatIntervalMs(type) {
  return getHandlerHeartbeatIntervalMsRuntime(
    ensureHandler,
    { DEFAULT_HEARTBEAT_INTERVAL_MS },
    getHandlerLeaseTimeoutMs,
    type,
  );
}

function getHandlerTimeoutMs(type) {
  return getHandlerTimeoutMsRuntime(
    ensureHandler,
    { DEFAULT_TIMEOUT_MS },
    type,
  );
}

function getActiveCount(type) {
  return activeCountsByType.get(type) || 0;
}

function setActiveCount(type, count) {
  activeCountsByType.set(type, Math.max(0, count));
}

function canRunMore(type) {
  return getActiveCount(type) < getHandlerConcurrency(type);
}

function isWorkerEnabled() {
  if (typeof isWorkerEnabledHook === 'function') {
    try {
      return isWorkerEnabledHook() !== false;
    } catch (error) {
      log('worker.enabled_check_error', { message: toErrorMessage(error) });
    }
  }
  return true;
}

function createJobDeferred(delayMs, reason) {
  return {
    __jobDeferred: true,
    delayMs: Math.max(250, parseInt(delayMs, 10) || DEFAULT_RETRY_DELAY_MS),
    reason: String(reason || ''),
  };
}

export function deferJobExecution(delayMs, reason) {
  return createJobDeferred(delayMs, reason);
}

async function appendJobLog(jobOrFields, event, details = {}) {
  if (!Meteor.isServer) return;
  const source =
    jobOrFields && typeof jobOrFields === 'object' ? jobOrFields : {};
  const entry = {
    jobId: String(source._id || source.jobId || ''),
    type: String(source.type || ''),
    status: String(source.status || ''),
    event: String(event || ''),
    attempt: Number(source.attempts) || 0,
    lockToken: String(source.lockToken || ''),
    createdAt: nowDate(),
    details:
      details && typeof details === 'object' ? details : { value: details },
  };
  try {
    await JobLogs.insertAsync(entry);
  } catch (error) {
    log('log.insert_error', {
      jobId: entry.jobId,
      event: entry.event,
      message: toErrorMessage(error),
    });
  }
}

async function appendDeadLetter(job, error, reason) {
  if (!Meteor.isServer || !job) return;
  const deadLetter = {
    jobId: String(job._id || ''),
    type: String(job.type || ''),
    dedupeKey: String(job.dedupeKey || ''),
    payload: job.payload || {},
    attempts: Number(job.attempts) || 0,
    maxAttempts: Number(job.maxAttempts) || 0,
    failedAt: nowDate(),
    reason: String(reason || 'final-failure'),
    errorMessage: toErrorMessage(error),
    lastError: String(job.lastError || ''),
    timeoutMs: Number(job.timeoutMs) || 0,
    leaseTimeoutMs: Number(job.leaseTimeoutMs) || 0,
    heartbeatIntervalMs: Number(job.heartbeatIntervalMs) || 0,
    snapshot: {
      ...job,
      payload: job.payload || {},
    },
  };
  try {
    await DeadLetterJobs.insertAsync(deadLetter);
  } catch (insertError) {
    log('dead_letter.insert_error', {
      jobId: deadLetter.jobId,
      message: toErrorMessage(insertError),
    });
  }
}

function scheduleDrain(type) {
  Meteor.defer(() => {
    drainJobs(type).catch((error) => {
      log('drain.error', { type, message: toErrorMessage(error) });
    });
  });
}

function stopJobHeartbeat(jobId) {
  const timer = heartbeatTimersByJobId.get(String(jobId || ''));
  if (timer) {
    Meteor.clearInterval(timer);
    heartbeatTimersByJobId.delete(String(jobId || ''));
  }
}

async function heartbeatJobLease(job) {
  const leaseTimeoutMs = Math.max(
    1_000,
    parseInt(job.leaseTimeoutMs, 10) || DEFAULT_LEASE_TIMEOUT_MS,
  );
  const heartbeatAt = nowDate();
  const leaseUntil = new Date(heartbeatAt.getTime() + leaseTimeoutMs);
  const result = await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        updatedAt: heartbeatAt,
        heartbeatAt,
        lockUntil: leaseUntil,
      },
    },
    {
      returnDocument: 'after',
    },
  );
  const nextJob =
    result && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result || null;
  if (nextJob) {
    job.lockUntil = nextJob.lockUntil;
    job.heartbeatAt = nextJob.heartbeatAt;
    await appendJobLog(nextJob, 'heartbeat', {
      lockUntil: nextJob.lockUntil,
    });
  }
  return nextJob;
}

function startJobHeartbeat(job) {
  stopJobHeartbeat(job && job._id);
  const intervalMs = Math.max(
    500,
    parseInt(job && job.heartbeatIntervalMs, 10) ||
      DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  const timer = Meteor.setInterval(() => {
    heartbeatJobLease(job).catch((error) => {
      log('heartbeat.error', {
        jobId: job && job._id,
        type: job && job.type,
        message: toErrorMessage(error),
      });
    });
  }, intervalMs);
  heartbeatTimersByJobId.set(String((job && job._id) || ''), timer);
  return () => stopJobHeartbeat(job && job._id);
}

async function claimNextJob(type) {
  const collection = Jobs.rawCollection();
  const now = nowDate();
  const leaseTimeoutMs = getHandlerLeaseTimeoutMs(type);
  const heartbeatIntervalMs = getHandlerHeartbeatIntervalMs(type);
  const timeoutMs = getHandlerTimeoutMs(type);
  const result = await collection.findOneAndUpdate(
    {
      type,
      status: { $in: [JOB_STATUS.QUEUED, JOB_STATUS.RETRYING] },
      runAt: { $lte: now },
    },
    {
      $set: {
        status: JOB_STATUS.LEASED,
        updatedAt: now,
        leasedAt: now,
        startedAt: null,
        heartbeatAt: now,
        timeoutMs,
        leaseTimeoutMs,
        heartbeatIntervalMs,
        lockToken: Random.id(),
        lockUntil: new Date(now.getTime() + leaseTimeoutMs),
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { priority: -1, runAt: 1, createdAt: 1 },
      returnDocument: 'after',
    },
  );

  const job =
    result &&
    typeof result === 'object' &&
    Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result || null;
  if (job) {
    log('claimed', {
      jobId: job._id,
      type,
      attempts: job.attempts,
      dedupeKey: job.dedupeKey || '',
      leaseUntil: job.lockUntil,
    });
    await appendJobLog(job, 'claimed', {
      dedupeKey: job.dedupeKey || '',
      leaseUntil: job.lockUntil,
    });
  }
  return job;
}

async function markJobRunning(job) {
  const startedAt = nowDate();
  const result = await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: JOB_STATUS.LEASED,
    },
    {
      $set: {
        status: JOB_STATUS.RUNNING,
        startedAt,
        updatedAt: startedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );
  const nextJob =
    result && Object.prototype.hasOwnProperty.call(result, 'value')
      ? result.value
      : result || null;
  if (nextJob) {
    Object.assign(job, nextJob);
    await appendJobLog(nextJob, 'running', {});
  }
  return nextJob;
}

async function markJobCompleted(job, resultValue) {
  const completedAt = nowDate();
  await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        status: JOB_STATUS.COMPLETED,
        result: resultValue,
        updatedAt: completedAt,
        completedAt,
        heartbeatAt: completedAt,
        lockUntil: null,
      },
      $unset: {
        lastError: '',
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
    },
    {
      returnDocument: 'after',
    },
  );
  await appendJobLog(job, 'completed', {});
}

async function markJobCancelled(job, reason) {
  const cancelledAt = nowDate();
  await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        status: JOB_STATUS.CANCELLED,
        updatedAt: cancelledAt,
        completedAt: cancelledAt,
        lastError: String(reason || 'cancelled'),
        lockUntil: null,
      },
      $unset: {
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
    },
    {
      returnDocument: 'after',
    },
  );
  await appendJobLog(job, 'cancelled', {
    reason: String(reason || 'cancelled'),
  });
}

async function requeueDeferredJob(job, outcome) {
  const delayMs = Math.max(
    250,
    parseInt(outcome && outcome.delayMs, 10) || DEFAULT_RETRY_DELAY_MS,
  );
  const reason = outcome && outcome.reason ? String(outcome.reason) : '';
  const runAt = new Date(Date.now() + delayMs);
  await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        status: JOB_STATUS.RETRYING,
        runAt,
        updatedAt: nowDate(),
        heartbeatAt: nowDate(),
        lockUntil: null,
        lastError: reason,
      },
      $unset: {
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
      $inc: { attempts: -1 },
    },
    {
      returnDocument: 'after',
    },
  );
  await appendJobLog(job, 'deferred', {
    delayMs,
    reason,
  });
  if (reason !== 'blocked by edit lock') {
    log('deferred', {
      jobId: job._id,
      type: job.type,
      delayMs,
      reason,
    });
  }
}

async function requeueFailedJob(job, error) {
  const retryPolicy = getHandlerRetryPolicy(job.type);
  const maxAttempts = Math.max(
    1,
    parseInt(job.maxAttempts, 10) || retryPolicy.maxAttempts,
  );
  const retryDelayMs = Math.max(
    250,
    parseInt(job.retryDelayMs, 10) || retryPolicy.retryDelayMs,
  );
  const attempts = Math.max(1, Number(job.attempts) || 1);
  const nextDelayMs = Math.min(
    retryPolicy.maxRetryDelayMs,
    Math.round(
      retryDelayMs *
        Math.pow(retryPolicy.backoffMultiplier, Math.max(0, attempts - 1)),
    ),
  );

  if ((job.attempts || 0) < maxAttempts) {
    const runAt = new Date(Date.now() + nextDelayMs);
    await Jobs.rawCollection().findOneAndUpdate(
      {
        _id: job._id,
        lockToken: job.lockToken,
        status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
      },
      {
        $set: {
          status: JOB_STATUS.RETRYING,
          runAt,
          updatedAt: nowDate(),
          heartbeatAt: nowDate(),
          lockUntil: null,
          lastError: toErrorMessage(error),
        },
        $unset: {
          leaseTimeoutMs: '',
          heartbeatIntervalMs: '',
          lockToken: '',
        },
      },
      {
        returnDocument: 'after',
      },
    );
    await appendJobLog(job, 'retrying', {
      delayMs: nextDelayMs,
      maxAttempts,
      message: toErrorMessage(error),
    });
    log('retry', {
      jobId: job._id,
      type: job.type,
      attempts: job.attempts,
      maxAttempts,
      message: toErrorMessage(error),
      delayMs: nextDelayMs,
    });
    return;
  }

  const failedAt = nowDate();
  await Jobs.rawCollection().findOneAndUpdate(
    {
      _id: job._id,
      lockToken: job.lockToken,
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        status: JOB_STATUS.FAILED,
        updatedAt: failedAt,
        completedAt: failedAt,
        heartbeatAt: failedAt,
        lockUntil: null,
        lastError: toErrorMessage(error),
      },
      $unset: {
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
    },
    {
      returnDocument: 'after',
    },
  );
  await appendDeadLetter(job, error, 'final-failure');
  await appendJobLog(job, 'failed', {
    maxAttempts,
    message: toErrorMessage(error),
  });
  log('failed', {
    jobId: job._id,
    type: job.type,
    attempts: job.attempts,
    message: toErrorMessage(error),
  });
}

async function executeClaimedJob(type, job, handler) {
  const stopHeartbeat = startJobHeartbeat(job);
  let timeoutTimer = null;
  let runPromise = null;
  try {
    const runningJob = await markJobRunning(job);
    if (!runningJob) {
      return;
    }

    const timeoutMs = Math.max(
      1_000,
      parseInt(runningJob.timeoutMs, 10) || DEFAULT_TIMEOUT_MS,
    );
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = Meteor.setTimeout(() => {
        reject(new Error(`Job timed out after ${timeoutMs} ms`));
      }, timeoutMs);
    });
    runPromise = Promise.resolve().then(() => handler.run(runningJob));
    runPromise.catch(() => {});

    const result = await Promise.race([runPromise, timeoutPromise]);

    if (result && result.__jobDeferred) {
      await requeueDeferredJob(runningJob, result);
    } else {
      await markJobCompleted(runningJob, result);
      log('completed', { jobId: runningJob._id, type });
    }
  } catch (error) {
    await requeueFailedJob(job, error);
  } finally {
    if (timeoutTimer) {
      Meteor.clearTimeout(timeoutTimer);
    }
    stopHeartbeat();
    setActiveCount(type, getActiveCount(type) - 1);
    scheduleDrain(type);
  }
}

async function drainJobs(type) {
  if (!Meteor.isServer) return;
  if (!isWorkerEnabled()) {
    return;
  }
  while (canRunMore(type)) {
    const job = await claimNextJob(type);
    if (!job) {
      return;
    }

    const handler = ensureHandler(type);
    setActiveCount(type, getActiveCount(type) + 1);
    executeClaimedJob(type, job, handler).catch((error) => {
      log('execute.error', {
        jobId: job && job._id,
        type,
        message: toErrorMessage(error),
      });
    });
  }
}

async function recoverInterruptedJobs() {
  const now = nowDate();
  await Jobs.updateAsync(
    {
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
    },
    {
      $set: {
        status: JOB_STATUS.QUEUED,
        updatedAt: now,
        runAt: now,
        lockUntil: null,
        lastError: 'Recovered on worker startup',
      },
      $unset: {
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
    },
    { multi: true },
  );
}

async function recoverExpiredLeases() {
  const now = nowDate();
  const expiredJobs = await Jobs.find(
    {
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
      lockUntil: { $lte: now },
    },
    {
      fields: {
        _id: 1,
        type: 1,
        status: 1,
        attempts: 1,
        lockToken: 1,
        lastError: 1,
      },
    },
  ).fetchAsync();

  if (!expiredJobs.length) return;

  await Jobs.updateAsync(
    {
      status: { $in: [JOB_STATUS.LEASED, JOB_STATUS.RUNNING] },
      lockUntil: { $lte: now },
    },
    {
      $set: {
        status: JOB_STATUS.RETRYING,
        updatedAt: now,
        runAt: now,
        lockUntil: null,
        lastError: 'Recovered expired lease',
      },
      $unset: {
        leaseTimeoutMs: '',
        heartbeatIntervalMs: '',
        lockToken: '',
      },
    },
    { multi: true },
  );

  for (let i = 0; i < expiredJobs.length; i += 1) {
    const job = expiredJobs[i];
    stopJobHeartbeat(job && job._id);
    await appendJobLog(job, 'lease_recovered', {
      reason: 'expired-lease',
    });
    log('lease.recovered', {
      jobId: job && job._id,
      type: job && job.type,
      status: job && job.status,
    });
  }
}

function startRecoverySweep() {
  if (recoverySweepTimer) return;
  recoverySweepTimer = Meteor.setInterval(() => {
    recoverExpiredLeases()
      .then(() => {
        pokeJobsWorker();
      })
      .catch((error) => {
        log('recovery.error', { message: toErrorMessage(error) });
      });
  }, DEFAULT_RECOVERY_SWEEP_INTERVAL_MS);
}

function validateRegisteredHandler(type, options) {
  return validateRegisteredHandlerRuntime(type, options);
}

function getJobHandlerMetadata(type) {
  return getJobHandlerMetadataRuntime(
    ensureHandler,
    getHandlerTimeoutMs,
    getHandlerLeaseTimeoutMs,
    getHandlerHeartbeatIntervalMs,
    getHandlerRetryPolicy,
    type,
  );
}

export function registerJobHandler(type, options) {
  validateRegisteredHandler(type, options);
  const normalizedType = String(type || '').trim();

  jobHandlers.set(normalizedType, {
    run: options.run,
    concurrency: options.concurrency,
    maxAttempts: options.maxAttempts,
    retryDelayMs: options.retryDelayMs,
    retryPolicy: options.retryPolicy,
    timeoutMs: options.timeoutMs,
    leaseTimeoutMs: options.leaseTimeoutMs,
    heartbeatIntervalMs: options.heartbeatIntervalMs,
    payloadSchema: options.payloadSchema,
    payloadSchemaDescription: String(options.payloadSchemaDescription || ''),
    idempotencyStrategy: String(options.idempotencyStrategy || ''),
    description: String(options.description || ''),
  });

  if (Meteor.isServer && jobsWorkerStarted) {
    scheduleDrain(normalizedType);
  }
}

export async function enqueueDurableJob({
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
}) {
  return enqueueDurableJobRuntime(
    {
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
    },
    {
      type,
      payload,
      dedupeKey,
      priority,
      maxAttempts,
      retryDelayMs,
      runAt,
      timeoutMs,
      leaseTimeoutMs,
      heartbeatIntervalMs,
    },
  );
}

export async function waitForJobResult(jobId, options = {}) {
  return waitForJobResultRuntime(
    {
      Jobs,
      JOB_STATUS,
      DEFAULT_WAIT_TIMEOUT_MS,
      DEFAULT_POLL_INTERVAL_MS,
    },
    jobId,
    options,
  );
}

export async function enqueueDurableJobAndWait(options = {}, waitOptions = {}) {
  return enqueueDurableJobAndWaitRuntime(
    {
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
      DEFAULT_WAIT_TIMEOUT_MS,
      DEFAULT_POLL_INTERVAL_MS,
    },
    options,
    waitOptions,
  );
}

export function startJobsWorker() {
  if (!Meteor.isServer || jobsWorkerStarted) return;
  jobsWorkerStarted = true;
  recoverInterruptedJobs()
    .then(() => {
      startRecoverySweep();
      log('worker.started', { handlers: Array.from(jobHandlers.keys()) });
      Array.from(jobHandlers.keys()).forEach((type) => {
        scheduleDrain(type);
      });
    })
    .catch((error) => {
      log('worker.start_error', { message: toErrorMessage(error) });
    });
}

export function isJobsWorkerStarted() {
  return jobsWorkerStarted;
}

export function pokeJobsWorker() {
  if (!Meteor.isServer || !jobsWorkerStarted) return;
  Array.from(jobHandlers.keys()).forEach((type) => {
    scheduleDrain(type);
  });
}

export function registerJobsRuntimeHooks(hooks) {
  const nextHooks = hooks || {};
  if (typeof nextHooks.isWorkerEnabled === 'function') {
    isWorkerEnabledHook = nextHooks.isWorkerEnabled;
  }
}

if (Meteor.isServer) {
  Meteor.methods({
    async 'jobs.get'(jobId) {
      check(jobId, String);
      return Jobs.findOneAsync(jobId);
    },
    async 'jobs.logs'(jobId, limit = 100) {
      check(jobId, String);
      check(limit, Match.Optional(Number));
      return JobLogs.find(
        { jobId },
        {
          sort: { createdAt: -1 },
          limit: Math.max(1, Math.min(500, parseInt(limit, 10) || 100)),
        },
      ).fetchAsync();
    },
    async 'jobs.deadLetters'(type = '', limit = 100) {
      check(type, Match.Optional(String));
      check(limit, Match.Optional(Number));
      const selector = String(type || '').trim()
        ? { type: String(type || '').trim() }
        : {};
      return DeadLetterJobs.find(selector, {
        sort: { failedAt: -1 },
        limit: Math.max(1, Math.min(500, parseInt(limit, 10) || 100)),
      }).fetchAsync();
    },
    async 'jobs.cancel'(jobId) {
      check(jobId, String);
      const now = nowDate();
      const current = await Jobs.findOneAsync(jobId);
      if (!current) {
        throw new Meteor.Error('job-not-found', 'Job not found');
      }
      if (
        [
          JOB_STATUS.COMPLETED,
          JOB_STATUS.FAILED,
          JOB_STATUS.CANCELLED,
        ].includes(String(current.status || ''))
      ) {
        return current;
      }

      await Jobs.updateAsync(
        { _id: jobId },
        {
          $set: {
            status: JOB_STATUS.CANCELLED,
            updatedAt: now,
            completedAt: now,
            lastError: 'Cancelled manually',
            lockUntil: null,
          },
          $unset: {
            leaseTimeoutMs: '',
            heartbeatIntervalMs: '',
            lockToken: '',
          },
        },
      );
      stopJobHeartbeat(jobId);
      await appendJobLog(current, 'cancelled', {
        reason: 'manual-cancel',
      });
      return Jobs.findOneAsync(jobId);
    },
    async 'jobs.enqueue'(type, payload) {
      check(type, String);
      check(payload, jobPayloadMatch);
      const job = await enqueueDurableJob({ type, payload });
      return job && job._id;
    },
  });
}
