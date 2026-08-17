# NEXUS Kubernetes Guide

This guide details how to deploy NEXUS to a local or remote Kubernetes cluster using our unified Helm chart.

## Prerequisites
- A running Kubernetes cluster (e.g., `minikube`, `kind`, EKS, GKE)
- `helm` installed locally
- `kubectl` configured

## 1. Local Validation with Minikube / Kind

Before deploying to production, validate the Helm chart on a local cluster.

```bash
# Lint the chart for syntax errors
helm lint deploy/helm/nexus

# Render the templates locally (Dry Run)
helm template nexus deploy/helm/nexus -f deploy/helm/nexus/values-dev.yaml
```

## 2. Secrets Management
The Helm chart requires external secrets for databases and JWT signatures. In a real environment, you should use an external secret operator (like AWS Secrets Manager or HashiCorp Vault). For manual installation, pass them via CLI:

```bash
helm upgrade --install nexus deploy/helm/nexus \
  --namespace nexus-dev \
  --create-namespace \
  -f deploy/helm/nexus/values-dev.yaml \
  --set secrets.databaseUrl="postgresql://user:pass@host:5432/db" \
  --set secrets.redisUrl="redis://host:6379" \
  --set secrets.jwtAccessSecret="min-32-char-secret..." \
  --set secrets.jwtRefreshSecret="min-32-char-secret..."
```

## 3. Database Migrations
Our Helm chart uses a `pre-upgrade` hook to run Prisma Migrations.
When you run `helm upgrade`, Kubernetes will:
1. Spin up a Job container running `pnpm dlx prisma migrate deploy`.
2. Wait for the Job to succeed.
3. Begin rolling out the new API and Worker pods.
This guarantees zero-downtime structural upgrades!

## 4. Rollback
If a deployment fails, use Helm's native rollback mechanism:
```bash
helm history nexus -n nexus-prod
helm rollback nexus 1 -n nexus-prod
```
