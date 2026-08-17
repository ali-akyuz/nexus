# NEXUS Worker Infrastructure

## Overview
NEXUS uses BullMQ and Redis to manage distributed asynchronous tasks. 
Workers are standalone Node.js processes built using `@nestjs/bullmq`.

## Processor Worker
The `processor` worker consumes jobs from the `default` queue.
Its primary responsibilities are:
1. Validating the job against PostgreSQL (`Job` table).
2. Updating worker node and job status to `PROCESSING`.
3. Offloading the actual computation to the **Python ML Service** via an HTTP Stream.
4. Parsing the streaming NDJSON progress events and writing them to the database and Redis queue (which triggers the WebSocket Gateway).
5. Catching timeouts or errors, updating the `Job` to `FAILED`, and honoring BullMQ's native retry mechanics.

## Idempotency
Workers are designed to be idempotent. If a job is re-delivered, the worker first checks if the `JobStatus` is already `COMPLETED` or `CANCELLED`. If so, it safely skips execution to prevent duplicate work or data corruption.
