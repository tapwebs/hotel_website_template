#!/usr/bin/env bash
# ==============================================================================
# Automated Database Backup Script for Hotel Dream Heaven's (PostgreSQL)
# ==============================================================================
# Features:
# 1. Dumps PostgreSQL schema and data using pg_dump.
# 2. Compresses with gzip.
# 3. Computes SHA256 checksum for corruption detection.
# 4. Supports off-site upload to S3 / Cloudflare R2 / rclone if configured.
# 5. Automatically rotates and purges backups older than 30 days.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dh_db_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

# Determine DB Connection string from environment
DB_URL="${DATABASE_URL:-}"
if [ -z "${DB_URL}" ] && [ -f "backend/.env" ]; then
  DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

echo "==> Starting database backup at $(date)..."

if [[ "${DB_URL}" == *"sqlite"* ]]; then
  echo "==> Detected SQLite database. Creating atomic file snapshot..."
  DB_PATH=$(echo "${DB_URL}" | sed -E 's|^sqlite\+aiosqlite:///||; s|^sqlite:///||')
  if [ ! -f "${DB_PATH}" ]; then
    echo "ERROR: SQLite database file not found at ${DB_PATH}"
    exit 1
  fi
  gzip -c "${DB_PATH}" > "${BACKUP_FILE}"
else
  echo "==> Executing PostgreSQL pg_dump..."
  if [ -n "${DB_URL}" ]; then
    pg_dump "${DB_URL}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${BACKUP_FILE}"
  else
    PGHOST="${PGHOST:-127.0.0.1}"
    PGPORT="${PGPORT:-5432}"
    PGUSER="${PGUSER:-postgres}"
    PGDATABASE="${PGDATABASE:-dreamheavens}"
    pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${BACKUP_FILE}"
  fi
fi

# Generate Checksum
shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
echo "==> Backup created successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
echo "==> Checksum: $(cat "${CHECKSUM_FILE}")"

# Offsite upload (if configured)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "==> Uploading backup to S3/R2 bucket: ${BACKUP_S3_BUCKET}..."
  aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/db-backups/"
  aws s3 cp "${CHECKSUM_FILE}" "s3://${BACKUP_S3_BUCKET}/db-backups/"
  echo "==> Offsite upload complete."
elif [ -n "${RCLONE_DEST:-}" ]; then
  echo "==> Syncing backup via rclone to: ${RCLONE_DEST}..."
  rclone copy "${BACKUP_FILE}" "${RCLONE_DEST}/"
  rclone copy "${CHECKSUM_FILE}" "${RCLONE_DEST}/"
fi

# Retention policy: Delete local backups older than 30 days
echo "==> Purging local backups older than 30 days..."
find "${BACKUP_DIR}" -name "dh_db_*.sql.gz*" -mtime +30 -delete

echo "==> Database backup workflow completed successfully at $(date)."
