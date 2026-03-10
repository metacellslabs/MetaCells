import { Meteor } from "meteor/meteor";
import { Mongo } from "meteor/mongo";
import { check, Match } from "meteor/check";
import { Random } from "meteor/random";

export const Jobs = new Mongo.Collection("jobs");

export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
};

const DEFAULT_WAIT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 250;
const DEFAULT_LOCK_RECOVERY_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const jobPayloadMatch = Match.Where((value) => !!value && typeof value === "object" && !Array.isArray(value));

const jobHandlers = new Map();
const activeCountsByType = new Map();
let jobsWorkerStarted = false;
let isWorkerEnabledHook = null;

function log(event, payload) {
  console.log(`[jobs] ${event}`, payload);
}

function nowDate() {
  return new Date();
}

function toErrorMessage(error) {
  if (!error) return "Unknown job error";
  if (typeof error === "string") return error;
  if (error && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  return String(error);
}

function ensureHandler(type) {
  const handler = jobHandlers.get(String(type || ""));
  if (!handler) {
    throw new Error(`No job handler registered for ${String(type || "")}`);
  }
  return handler;
}

function resolveHandlerValue(value, type, fallback) {
  if (typeof value === "function") {
    const resolved = value(type);
    return resolveHandlerValue(resolved, type, fallback);
  }
  const numeric = parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getHandlerConcurrency(type) {
  const handler = ensureHandler(type);
  return Math.max(1, resolveHandlerValue(handler.concurrency, type, 1));
}

function getHandlerMaxAttempts(type) {
  const handler = ensureHandler(type);
  return Math.max(1, resolveHandlerValue(handler.maxAttempts, type, 1));
}

function getHandlerRetryDelayMs(type) {
  const handler = ensureHandler(type);
  return Math.max(250, resolveHandlerValue(handler.retryDelayMs, type, DEFAULT_RETRY_DELAY_MS));
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
  if (typeof isWorkerEnabledHook === "function") {
    try {
      return isWorkerEnabledHook() !== false;
    } catch (error) {
      log("worker.enabled_check_error", { message: toErrorMessage(error) });
    }
  }
  return true;
}

function createJobDeferred(delayMs, reason) {
  return {
    __jobDeferred: true,
    delayMs: Math.max(250, parseInt(delayMs, 10) || DEFAULT_RETRY_DELAY_MS),
    reason: String(reason || ""),
  };
}

export function deferJobExecution(delayMs, reason) {
  return createJobDeferred(delayMs, reason);
}

function scheduleDrain(type) {
  Meteor.defer(() => {
    drainJobs(type).catch((error) => {
      log("drain.error", { type, message: toErrorMessage(error) });
    });
  });
}

async function claimNextJob(type) {
  const collection = Jobs.rawCollection();
  const now = nowDate();
  const result = await collection.findOneAndUpdate(
    {
      type,
      status: JOB_STATUS.QUEUED,
      runAt: { $lte: now },
    },
    {
      $set: {
        status: JOB_STATUS.RUNNING,
        updatedAt: now,
        startedAt: now,
        lockToken: Random.id(),
        lockUntil: new Date(now.getTime() + DEFAULT_LOCK_RECOVERY_WINDOW_MS),
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { priority: -1, runAt: 1, createdAt: 1 },
      returnDocument: "after",
    },
  );

  const job = result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "value")
    ? result.value
    : result || null;
  if (job) {
    log("claimed", {
      jobId: job._id,
      type,
      attempts: job.attempts,
      dedupeKey: job.dedupeKey || "",
    });
  }
  return job;
}

async function markJobCompleted(jobId, result) {
  const completedAt = nowDate();
  await Jobs.updateAsync(
    { _id: jobId },
    {
      $set: {
        status: JOB_STATUS.COMPLETED,
        result,
        updatedAt: completedAt,
        completedAt,
        lockUntil: null,
      },
      $unset: {
        lastError: "",
      },
    },
  );
}

async function requeueDeferredJob(job, outcome) {
  const delayMs = Math.max(250, parseInt(outcome && outcome.delayMs, 10) || DEFAULT_RETRY_DELAY_MS);
  const runAt = new Date(Date.now() + delayMs);
  await Jobs.updateAsync(
    { _id: job._id },
    {
      $set: {
        status: JOB_STATUS.QUEUED,
        runAt,
        updatedAt: nowDate(),
        lockUntil: null,
        lastError: outcome && outcome.reason ? String(outcome.reason) : "",
      },
      $inc: { attempts: -1 },
    },
  );
  log("deferred", {
    jobId: job._id,
    type: job.type,
    delayMs,
    reason: outcome && outcome.reason ? String(outcome.reason) : "",
  });
}

async function requeueFailedJob(job, error, handler) {
  const maxAttempts = Math.max(1, parseInt(job.maxAttempts, 10) || getHandlerMaxAttempts(job.type));
  const retryDelayMs = Math.max(250, parseInt(job.retryDelayMs, 10) || getHandlerRetryDelayMs(job.type));

  if ((job.attempts || 0) < maxAttempts) {
    const runAt = new Date(Date.now() + retryDelayMs);
    await Jobs.updateAsync(
      { _id: job._id },
      {
        $set: {
          status: JOB_STATUS.QUEUED,
          runAt,
          updatedAt: nowDate(),
          lockUntil: null,
          lastError: toErrorMessage(error),
        },
      },
    );
    log("retry", {
      jobId: job._id,
      type: job.type,
      attempts: job.attempts,
      maxAttempts,
      message: toErrorMessage(error),
    });
    return;
  }

  await Jobs.updateAsync(
    { _id: job._id },
    {
      $set: {
        status: JOB_STATUS.FAILED,
        updatedAt: nowDate(),
        completedAt: nowDate(),
        lockUntil: null,
        lastError: toErrorMessage(error),
      },
    },
  );
  log("failed", {
    jobId: job._id,
    type: job.type,
    attempts: job.attempts,
    message: toErrorMessage(error),
  });
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

    Promise.resolve()
      .then(() => handler.run(job))
      .then(async (result) => {
        if (result && result.__jobDeferred) {
          await requeueDeferredJob(job, result);
        } else {
          await markJobCompleted(job._id, result);
          log("completed", { jobId: job._id, type });
        }
      })
      .catch(async (error) => {
        await requeueFailedJob(job, error, handler);
      })
      .finally(() => {
        setActiveCount(type, getActiveCount(type) - 1);
        scheduleDrain(type);
      });
  }
}

async function recoverInterruptedJobs() {
  const now = nowDate();
  await Jobs.updateAsync(
    {
      status: JOB_STATUS.RUNNING,
    },
    {
      $set: {
        status: JOB_STATUS.QUEUED,
        updatedAt: now,
        runAt: now,
        lockUntil: null,
      },
    },
    { multi: true },
  );
}

export function registerJobHandler(type, options) {
  const normalizedType = String(type || "").trim();
  if (!normalizedType) throw new Error("Job handler requires a type");
  if (!options || typeof options.run !== "function") {
    throw new Error(`Job handler ${normalizedType} must provide a run(job) function`);
  }

  jobHandlers.set(normalizedType, {
    run: options.run,
    concurrency: options.concurrency,
    maxAttempts: options.maxAttempts,
    retryDelayMs: options.retryDelayMs,
  });

  if (Meteor.isServer && jobsWorkerStarted) {
    scheduleDrain(normalizedType);
  }
}

export async function enqueueDurableJob({
  type,
  payload,
  dedupeKey = "",
  priority = 0,
  maxAttempts,
  retryDelayMs,
  runAt = null,
}) {
  const normalizedType = String(type || "").trim();
  if (!normalizedType) throw new Error("enqueueDurableJob requires a type");
  ensureHandler(normalizedType);

  const normalizedDedupeKey = String(dedupeKey || "").trim();
  if (normalizedDedupeKey) {
    const existing = await Jobs.findOneAsync({
      type: normalizedType,
      dedupeKey: normalizedDedupeKey,
      status: { $in: [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING] },
    });
    if (existing) {
      return existing;
    }
  }

  const createdAt = nowDate();
  const jobId = await Jobs.insertAsync({
    type: normalizedType,
    payload: payload || {},
    dedupeKey: normalizedDedupeKey,
    status: JOB_STATUS.QUEUED,
    attempts: 0,
    maxAttempts: Math.max(1, parseInt(maxAttempts, 10) || getHandlerMaxAttempts(normalizedType)),
    retryDelayMs: Math.max(250, parseInt(retryDelayMs, 10) || getHandlerRetryDelayMs(normalizedType)),
    priority: parseInt(priority, 10) || 0,
    runAt: runAt instanceof Date ? runAt : createdAt,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
    lockUntil: null,
    lockToken: "",
    lastError: "",
    result: null,
  });

  const job = await Jobs.findOneAsync(jobId);
  scheduleDrain(normalizedType);
  return job;
}

export async function waitForJobResult(jobId, options = {}) {
  const timeoutMs = Math.max(1_000, parseInt(options.timeoutMs, 10) || DEFAULT_WAIT_TIMEOUT_MS);
  const pollIntervalMs = Math.max(50, parseInt(options.pollIntervalMs, 10) || DEFAULT_POLL_INTERVAL_MS);
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
      throw new Error(String(job.lastError || "Job failed"));
    }
    await new Promise((resolve) => Meteor.setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

export async function enqueueDurableJobAndWait(options = {}, waitOptions = {}) {
  const job = await enqueueDurableJob(options);
  return waitForJobResult(job && job._id, waitOptions);
}

export function startJobsWorker() {
  if (!Meteor.isServer || jobsWorkerStarted) return;
  jobsWorkerStarted = true;
  recoverInterruptedJobs()
    .then(() => {
      log("worker.started", { handlers: Array.from(jobHandlers.keys()) });
      Array.from(jobHandlers.keys()).forEach((type) => {
        scheduleDrain(type);
      });
    })
    .catch((error) => {
      log("worker.start_error", { message: toErrorMessage(error) });
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
  if (typeof nextHooks.isWorkerEnabled === "function") {
    isWorkerEnabledHook = nextHooks.isWorkerEnabled;
  }
}

if (Meteor.isServer) {
  Meteor.methods({
    async "jobs.get"(jobId) {
      check(jobId, String);
      return Jobs.findOneAsync(jobId);
    },
    async "jobs.enqueue"(type, payload) {
      check(type, String);
      check(payload, jobPayloadMatch);
      const job = await enqueueDurableJob({ type, payload });
      return job && job._id;
    },
  });
}
