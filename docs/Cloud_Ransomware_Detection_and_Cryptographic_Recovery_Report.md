# Cloud Ransomware Detection & Cryptographic Recovery System

## Detailed Project Report

| Field | Value |
|---|---|
| **Project title** | Cloud Ransomware Detection & Cryptographic Recovery System |
| **Short name** | CloudRDR (Cloud Ransomware Detection & Recovery) |
| **Domain** | Cloud Security · Information Security Management Systems · Fundamentals of Cryptography |
| **Prepared for** | Information Security Management Systems / Cloud Security / Fundamentals of Cryptography |
| **Author** | _[Student name]_ |
| **Student ID** | _[ID]_ |
| **Supervisor** | _[Supervisor name]_ |
| **Version** | 1.0 |
| **Date** | October 2026 |
| **Status** | Final draft for submission |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Introduction](#2-introduction)
   - 2.1 [Problem Statement](#21-problem-statement)
   - 2.2 [Motivation](#22-motivation)
   - 2.3 [Scope](#23-scope)
3. [Objectives and Research Questions](#3-objectives-and-research-questions)
4. [Background and Related Work](#4-background-and-related-work)
5. [System Architecture](#5-system-architecture)
6. [Threat Model](#6-threat-model)
7. [Detailed Design](#7-detailed-design)
   - 7.1 [Storage Layer](#71-storage-layer)
   - 7.2 [Baseline Hashing](#72-baseline-hashing)
   - 7.3 [Detection Engine](#73-detection-engine)
   - 7.4 [Automated Response (Freeze)](#74-automated-response-freeze)
   - 7.5 [Backup and Verified Restore](#75-backup-and-verified-restore)
   - 7.6 [Cryptographic Protection of Evidence](#76-cryptographic-protection-of-evidence)
8. [Implementation Plan](#8-implementation-plan)
9. [ISMS Mapping](#9-isms-mapping)
10. [Cloud Security Mapping](#10-cloud-security-mapping)
11. [Cryptography Mapping](#11-cryptography-mapping)
12. [Demonstration Scenario](#12-demonstration-scenario)
13. [Evaluation and Success Metrics](#13-evaluation-and-success-metrics)
14. [Timeline and Milestones](#14-timeline-and-milestones)
15. [Risks, Assumptions and Limitations](#15-risks-assumptions-and-limitations)
16. [Future Work](#16-future-work)
17. [References](#17-references)
18. [Appendix A — Mapping Summary](#appendix-a--mapping-summary)

---

## 1. Executive Summary

Ransomware is one of the most damaging threats facing cloud-hosted data. Unlike
traditional malware, its primary objective is not to steal data but to **destroy
its availability** by encrypting files and demanding payment. Because cloud
storage is often treated as the "source of truth" for an organisation, a
ransomware event that reaches cloud object storage can halt an entire business.
Detection is difficult because a legitimate bulk file operation and a malicious
mass-encryption operation look superficially similar: in both cases many files
change in a short period of time.

This project designs, builds and evaluates **CloudRDR** — a lightweight,
cloud-native system that:

1. continuously **monitors** cloud storage and computes a **SHA-256 baseline
   hash** for every protected file;
2. **detects** anomalous mass modification by comparing current hashes against
   the baseline and applying a time-windowed change-rate threshold;
3. **responds automatically** by isolating the affected account or workload
   (forcing read-only access) and preserving an immutable, cryptographically
   protected incident record;
4. **restores** affected data from encrypted, integrity-verified backups, and
   then **proves** that the restore is bit-for-bit identical to the trusted
   baseline.

The project sits at the intersection of the three courses:

- **Information Security Management Systems (ISMS):** incident response,
  business continuity and disaster recovery planning, risk assessment, asset
  classification, and evidence handling mapped to ISO/IEC 27001:2022 and the
  NIST Cybersecurity Framework 2.0.
- **Cloud Security:** cloud object storage, IAM-based account isolation,
  immutability/versioning, cloud logging and monitoring, and the
  shared-responsibility model.
- **Fundamentals of Cryptography:** cryptographic hashing (SHA-256),
  Merkle-style hash chaining for tamper-evidence, digital signatures for
  non-repudiation of evidence, and AES-256-GCM authenticated encryption for
  backups and key management.

The expected outcome is a working prototype together with a governance package
that demonstrates how technical cloud controls translate into auditable ISMS
requirements. The deliverable is intentionally achievable in a single semester
while remaining technically credible and demonstrable.

---

## 2. Introduction

### 2.1 Problem Statement

Modern organisations store critical data in cloud object storage (Amazon S3,
Azure Blob Storage, Google Cloud Storage, Supabase Storage, and similar
services). These buckets frequently hold documents, database dumps, backups,
customer records and investigation evidence. Ransomware operators have adapted
to this reality: instead of encrypting a single endpoint, they target the
**cloud storage layer** and the **backup layer** simultaneously, so that the
victim cannot recover without paying.

Three problems make this class of attack hard to defend:

1. **Detection ambiguity.** A backup job, a bulk import, or a legitimate
   migration can change thousands of files within seconds — exactly the same
   observable pattern as ransomware encryption. A naive "file changed → alert"
   rule produces unusable noise.
2. **Recovery trust.** After an incident, restoring data is only useful if the
   organisation can *prove* the restored data is the genuine, unmodified
   original. Without cryptographic integrity, a restore from a compromised
   backup may silently reinstate attacker-tampered content.
3. **Evidence integrity.** Incident records must be admissible and
   non-repudiable. If an attacker (or an insider) can edit the incident log,
   the organisation loses its ability to reconstruct what happened.

CloudRDR addresses all three by combining **change-rate anomaly detection**,
**cryptographically verifiable backups**, and **tamper-evident, signed incident
records**.

### 2.2 Motivation

The choice of this topic is motivated by three observations:

- **Relevance.** Ransomware against cloud storage and backups is a documented,
  current, and rapidly growing threat class; it is not a theoretical problem.
- **Balance.** The core detection logic (hash comparison plus a threshold) is
  simple enough to build reliably within one semester, yet the design touches
  real cryptography (hashing, signatures, AEAD) and real governance
  (incident response, BCP/DRP, risk management).
- **Demonstrability.** The system produces a clear, visual, and repeatable
  demo: a simulated attack is launched, the system detects it, freezes the
  account, restores the data, and proves integrity. This makes the project easy
  to present and defend.

### 2.3 Scope

**In scope:**

- A simplified cloud storage layer (object storage with versioning).
- Continuous file monitoring and SHA-256 baseline hashing.
- A time-windowed anomaly detection engine.
- Automated response: account/workload isolation (read-only enforcement) and
  incident creation.
- Encrypted, signed, integrity-verified backup and restore.
- ISMS documentation: incident-response plan, BCP/DRP, risk register, asset
  classification, evidence-handling policy.

**Out of scope:**

- Real malware analysis or reverse engineering of actual ransomware families.
- Production-scale distributed storage (the prototype uses a single managed
  bucket).
- Full public-key infrastructure (PKI) with hardware security modules (HSMs);
  signatures use a generated key pair stored in a managed secret store.
- Legal admissibility certification; the project demonstrates the *technical*
  mechanisms that support it.

---

## 3. Objectives and Research Questions

**Overall objective:** Design, implement and evaluate a cloud-native system
that detects ransomware-style mass file modification, protects collected
evidence cryptographically, and restores data with verifiable integrity — while
mapping every technical control to recognised ISMS requirements.

**Specific objectives:**

| ID | Objective | Primary course |
|---|---|---|
| O1 | Build a monitoring pipeline that computes and stores SHA-256 baselines for all protected files | Cryptography |
| O2 | Implement a detection engine that distinguishes mass-encryption events from normal bulk activity using a time-windowed change-rate threshold | Cloud Security |
| O3 | Implement automated account isolation (IAM read-only) and incident record creation | Cloud Security |
| O4 | Protect backups with AES-256-GCM and sign incident/evidence manifests with digital signatures | Cryptography |
| O5 | Implement verified restore: compare restored hashes against the trusted baseline and report VALID/MODIFIED | Cryptography |
| O6 | Produce the ISMS package (IR plan, BCP/DRP, risk register, asset classification, evidence policy) and map controls to ISO/IEC 27001:2022 and NIST CSF 2.0 | ISMS |
| O7 | Evaluate the prototype against defined success metrics and document residual risk | All |

**Research questions:**

- **RQ1.** Can a simple, cloud-native change-rate detector reliably distinguish
  a ransomware mass-encryption event from ordinary bulk file activity with an
  acceptable false-positive rate?
- **RQ2.** How can cryptographic primitives (SHA-256, Merkle-style chaining,
  digital signatures, AES-256-GCM) be combined to make both the *evidence* and
  the *backups* verifiably tamper-evident in a cloud environment?
- **RQ3.** How do the technical controls implemented in the prototype map onto
  the requirements of ISO/IEC 27001:2022 and NIST CSF 2.0, and what residual
  risk remains?

---

## 4. Background and Related Work

### 4.1 Ransomware against cloud and backup infrastructure

Ransomware has evolved from endpoint-only encryption toward "double" and
"triple" extortion, in which attackers exfiltrate data, encrypt production
systems, and then specifically target backups to prevent recovery. Cloud object
storage is attractive to attackers because it is reachable with stolen
credentials (a compromised IAM key or session token), and because misconfigured
or overly permissive buckets allow mass read/write operations. Consequently,
modern defence-in-depth requires *both* detection on the storage side and
cryptographically verifiable, isolated backups.

### 4.2 Detection approaches

Common detection strategies for mass-encryption events include:

- **Change-rate (velocity) detection** — count file modifications per unit time
  and alert when the rate exceeds a learned or configured threshold. This is the
  approach used here because it is simple, explainable and cloud-native.
- **Entropy analysis** — encrypted content has high Shannon entropy; a sharp
  rise in file entropy is a strong ransomware indicator. This is noted as future
  work (Section 16) because it requires full file reads.
- **Canary / honeytoken files** — deliberately placed decoy files that should
  never change; if they change, an attack is likely. A low-cost complementary
  control.
- **Extension and magic-byte monitoring** — detecting mass renaming or header
  changes.

### 4.3 Relevant standards

- **ISO/IEC 27001:2022** — the ISMS requirement standard; Annex A contains 93
  controls organised into four themes: Organizational, People, Physical and
  Technological.
- **ISO/IEC 27017:2015** — cloud-specific security controls.
- **NIST Cybersecurity Framework (CSF) 2.0 (2024)** — six functions: *Govern,
  Identify, Protect, Detect, Respond, Recover*.
- **NIST SP 800-61** — Computer Security Incident Handling Guide.
- **NIST SP 800-34** — Contingency Planning Guide (basis for BCP/DRP).
- **NIST SP 800-57 Part 1 Rev. 5** — Recommendation for Key Management.
- **NIST SP 800-38D** — GCM/GMAC authenticated encryption.
- **FIPS 180-4** — Secure Hash Standard (SHA-256).
- **FIPS 186-5** — Digital Signature Standard (Ed25519/ECDSA/RSA).

### 4.4 Cryptographic building blocks used

- **SHA-256** (FIPS 180-4) for file and manifest hashing.
- **Merkle-style hash chaining** to make the evidence log tamper-evident: each
  entry embeds the hash of the previous entry.
- **Digital signatures** (Ed25519 or ECDSA P-256) for non-repudiation of
  incident and backup manifests.
- **AES-256-GCM** (SP 800-38D) for authenticated encryption of backups.

---

## 5. System Architecture

CloudRDR is composed of six loosely-coupled components. Each is a separate
concern, which keeps the design testable and keeps the implementation simple.

```
                 ┌──────────────────────────────────────────┐
                 │            CLOUD STORAGE                 │
                 │   (versioning + immutability enabled)    │
                 │   files/  ·  canary/  ·  evidence/       │
                 └───────────────────┬──────────────────────┘
                                     │  object events / polling
                                     ▼
                 ┌──────────────────────────────────────────┐
                 │            MONITOR (agent)               │
                 │  • read file  • compute SHA-256          │
                 │  • timestamp  • emit change record       │
                 └───────────────────┬──────────────────────┘
                                     ▼
                 ┌──────────────────────────────────────────┐
                 │         BASELINE STORE (hash map)        │
                 │  path -> { sha256, size, mtime, ver }    │
                 │  Merkle root over the whole baseline      │
                 └───────────────────┬──────────────────────┘
                                     ▼
                 ┌──────────────────────────────────────────┐
                 │           DETECTION ENGINE               │
                 │  • compare current vs baseline           │
                 │  • sliding time window (e.g. 30 s)       │
                 │  • change-rate = modified / total        │
                 │  • threshold rule + canary tripwire      │
                 └──────────┬──────────────┬────────────────┘
                            │              │
                    NORMAL  │              │  SUSPICIOUS
                            ▼              ▼
                   (continue)   ┌────────────────────────────┐
                                │        RESPONDER           │
                                │ 1. Freeze account (read-only│
                                │    IAM policy / deny-write) │
                                │ 2. Create incident record   │
                                │ 3. Sign incident manifest   │
                                └──────────┬─────────────────┘
                                           ▼
                                ┌────────────────────────────┐
                                │     BACKUP & RESTORE       │
                                │ • AES-256-GCM backup blobs  │
                                │ • signed backup manifest    │
                                │ • restore + hash verify     │
                                └──────────┬─────────────────┘
                                           ▼
                                ┌────────────────────────────┐
                                │       VERIFIER             │
                                │ recomputed hash == baseline │
                                │      → VALID / MODIFIED     │
                                └────────────────────────────┘
```

**Design principles applied:**

- **Separation of concerns.** Detection never performs recovery; the responder
  never computes hashes. This makes each component independently testable.
- **Fail-closed.** If the system cannot compute a hash, or cannot verify a
  backup signature, it treats the data as untrusted and refuses to restore.
- **Evidence-first.** The incident record is created and signed *before* any
  restore action, so the timeline is preserved.
- **Least privilege.** The monitor has read-only storage access; only the
  responder can change the IAM policy; only the backup component can write to
  the backup bucket.

---

## 6. Threat Model

A lightweight STRIDE-based threat model is used to identify what the system must
protect against and what is explicitly left out.

| Asset | Threat | STRIDE | Control in CloudRDR |
|---|---|---|---|
| Stored files | Mass encryption / destruction | Denial of Service | Change-rate detection, canary files |
| Stored files | Unauthorised deletion | Tampering | Versioning, immutability, restricted IAM |
| Baseline hash store | Attacker modifies baseline to hide changes | Tampering | Baseline stored separately, versioned, integrity-checked |
| Incident record | Attacker edits/deletes log to cover tracks | Repudiation | Hash-chained log + digital signature |
| Backup blobs | Attacker corrupts backup before restore | Tampering | AES-256-GCM AEAD (tamper detection), signed manifest |
| Backup blobs | Unauthorised disclosure | Information disclosure | AES-256-GCM encryption at rest |
| Encryption/signing keys | Theft or misuse | Elevation of privilege | Managed secret store, rotation, least privilege |
| Cloud credentials (IAM) | Stolen key used for mass write | Spoofing | Least privilege, short-lived credentials, MFA, alerting |
| Monitoring agent | Agent stopped to evade detection | Denial of Service | External heartbeat check; agent restart alert |

**Trust boundaries:** (1) between the storage account and the monitoring agent;
(2) between the agent and the baseline/evidence store; (3) between the backup
store and the restore process. Every crossing is authenticated, and the evidence
boundary is additionally cryptographically sealed.

**Explicitly out of scope:** nation-state adversaries with physical access to
the cloud provider, and zero-day exploits in the provider's own control plane.

---

## 7. Detailed Design

### 7.1 Storage Layer

The storage layer is a single managed object-storage bucket (Supabase Storage,
AWS S3, or an equivalent) with three logical prefixes:

```
bucket/
├── files/       # protected business/critical files
├── canary/      # decoy files that must never change
├── evidence/    # incident records and manifests
└── backup/      # encrypted, signed backup blobs
```

**Required storage features:**

- **Object versioning** — every overwrite keeps the previous version, so a
  malicious mass-overwrite does not destroy history.
- **Immutability / object-lock** — the `backup/` and `evidence/` prefixes are
  write-once (retention lock), so even a compromised admin cannot rewrite them.
- **Server-side encryption at rest** — as a baseline; CloudRDR adds its own
  application-layer encryption on top (defence in depth).
- **Separate credentials per prefix** — the monitor cannot write to `backup/`;
  the backup service cannot write to `files/`.

### 7.2 Baseline Hashing

The baseline is the trusted snapshot of the state of every protected file.

- For each file, the monitor records `{ path, sha256, size, mtime, version }`.
- The baseline is stored as a JSON manifest, and the **Merkle root** of all
  file hashes is computed and stored separately. Any single-file change alters
  the Merkle root, giving a single compact integrity value for the whole
  dataset.
- The baseline is itself protected: it is written once at "known-good" time,
  versioned, and its Merkle root is signed.

```javascript
// Conceptual baseline hashing (Node.js, built-in crypto only)
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function sha256File(path) {
  const data = readFileSync(path);                 // read bytes
  return createHash('sha256').update(data).digest('hex');
}

function merkleRoot(hashes) {
  if (hashes.length === 0) return null;
  let level = hashes.map(h => createHash('sha256').update(h).digest('hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = level[i + 1] ?? a;                 // duplicate last if odd
      next.push(createHash('sha256').update(a + b).digest('hex'));
    }
    level = next;
  }
  return level[0];
}

export { sha256File, merkleRoot };
```

### 7.3 Detection Engine

The detection engine converts raw change events into a decision.

**Inputs:** current file hashes, the baseline, and a stream of change events
with timestamps.

**Signal 1 — change-rate within a sliding window.**

```
for window W (e.g. 30 seconds):
    modified = |{ f : hash_now(f) != hash_baseline(f) }|
    rate     = modified / total_protected_files
    if rate >= RATE_THRESHOLD (e.g. 0.30):  -> SUSPICIOUS
```

**Signal 2 — canary tripwire.** Any modification of a `canary/` file is an
immediate, high-confidence trigger, because canary files have no legitimate
reason to change.

**Signal 3 — velocity of writes.** A burst of write operations (e.g. more than
N object writes per second) raises confidence even before the file count
threshold is reached.

```javascript
// Conceptual detection logic
const RATE_THRESHOLD = 0.30;   // 30% of protected files changed
const WINDOW_MS      = 30_000; // 30-second sliding window

function evaluate(changes, totalFiles, canaryHit) {
  if (canaryHit) {
    return { verdict: 'SUSPICIOUS', reason: 'CANARY_MODIFIED', confidence: 1.0 };
  }
  const now = Date.now();
  const recent = changes.filter(c => now - c.ts <= WINDOW_MS);
  const rate = recent.length / totalFiles;

  if (rate >= RATE_THRESHOLD) {
    return {
      verdict: 'SUSPICIOUS',
      reason: 'MASS_MODIFICATION',
      confidence: Math.min(1, rate / RATE_THRESHOLD * 0.9)
    };
  }
  return { verdict: 'NORMAL', reason: 'WITHIN_TOLERANCE', confidence: 0 };
}

export { evaluate, RATE_THRESHOLD, WINDOW_MS };
```

**Tuning and false positives.** The threshold is configurable. Legitimate bulk
jobs (backups, migrations) can be handled by an *allow-list window*: a declared
maintenance period during which the threshold is raised or the job's own
identity is exempt. This is the direct answer to RQ1 and is evaluated in
Section 13.

### 7.4 Automated Response (Freeze)

When the verdict is SUSPICIOUS, the responder executes a fixed playbook:

1. **Contain.** Detach the affected workload's credentials and apply a
   deny-write (read-only) IAM policy so that mass encryption can continue no
   further. In a managed-cloud setting this is an IAM policy change (deny
   `s3:PutObject` / `storage.objects.insert`) applied to the compromised
   principal.
2. **Preserve.** Snapshot the current (possibly corrupted) state into
   `evidence/` for later forensic analysis — never destroy the crime scene.
3. **Record.** Create a structured incident record containing: incident ID,
   detection timestamp, trigger signal, affected file list, Merkle root before
   and after, actor identity, and the actions taken.
4. **Seal.** Compute the incident manifest hash, chain it to the previous
   record's hash, and **sign** the resulting manifest with the responder's
   private key.

```jsonc
// Example incident record (evidence/INC-2026-0001.json)
{
  "incidentId": "INC-2026-0001",
  "detectedAt": "2026-10-03T14:22:07Z",
  "trigger": { "signal": "MASS_MODIFICATION", "rate": 0.82, "window": "30s" },
  "affected": 82,
  "merkleRootBefore": "9f2c...a1",
  "merkleRootAfter":  "4b71...e0",
  "actor": "svc-compromised-writer",
  "actions": ["IAM_DENY_WRITE_APPLIED", "SNAPSHOT_TAKEN", "BACKUP_PENDING"],
  "prevHash": "0c13...77",           // hash-chain link
  "signature": "MEUCIQ...base64"     // Ed25519 signature over the record
}
```

### 7.5 Backup and Verified Restore

**Backup.** Each protected file is stored as an AES-256-GCM blob together with
a unique nonce/IV and the authentication tag. A *backup manifest* lists every
file with its original SHA-256; the manifest is then signed.

**Restore.** After the incident is contained:

1. Verify the backup manifest's signature (reject if invalid).
2. Decrypt each blob with AES-256-GCM (the AEAD tag guarantees the ciphertext
   was not altered).
3. Recompute the SHA-256 of each restored file.
4. Compare against the trusted baseline hashes and against the manifest.
5. Recompute the Merkle root and compare with the signed baseline root.

Only if all checks pass is the restore declared **VALID**; otherwise the file
is reported **MODIFIED** and the restore is rolled back and escalated.

```javascript
// Conceptual AES-256-GCM backup/restore (Node.js built-in crypto)
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGO = 'aes-256-gcm';

function encryptBlob(key, plaintext) {           // key = 32 random bytes
  const iv = randomBytes(12);                    // 96-bit nonce for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ct };
}

function decryptBlob(key, { iv, tag, ct }) {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);                      // fails if tampered
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function verify(restoredBytes, baselineSha256) {
  const actual = createHash('sha256').update(restoredBytes).digest('hex');
  return actual === baselineSha256 ? 'VALID' : 'MODIFIED';
}

export { encryptBlob, decryptBlob, verify };
```

### 7.6 Cryptographic Protection of Evidence

The evidence subsystem provides three guarantees:

| Guarantee | Primitive | Mechanism |
|---|---|---|
| **Integrity** | SHA-256 | Every file and manifest is hashed; the Merkle root summarises the dataset |
| **Tamper-evidence** | Hash chaining | Each incident record embeds `prevHash`, so editing an earlier record breaks the chain |
| **Non-repudiation** | Digital signature (Ed25519 / ECDSA) | Both incident and backup manifests are signed; verification detects forgery |
| **Confidentiality** | AES-256-GCM | Backup blobs are encrypted; GCM also authenticates |
| **Key management** | Managed secret store + rotation | Keys are generated in and retrieved from a managed store, rotated on schedule, never hard-coded |

The result is that an investigator can answer the question *"has this evidence
been modified?"* with cryptographic certainty rather than trust.

---

## 8. Implementation Plan

### 8.1 Technology stack

The prototype deliberately uses a small, free, well-supported stack that runs on
a laptop and in the cloud without modification.

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 18+ (ES Modules) | Built-in `crypto` covers SHA-256, AES-GCM, signatures — no heavy dependencies |
| Storage | Supabase Storage (free tier) or MinIO/S3-compatible local emulation | Versioning + IAM-like policies; S3-compatible for portability |
| Database | Supabase Postgres (free tier) | Baseline + incident records + RLS |
| Monitoring | Node watcher process (polling or storage webhooks) | Simple, debuggable |
| Signing | Ed25519 via Node `crypto.sign`/`verify` | Fast, modern, small keys |
| Cloud IAM | Provider policy change (deny-write) | Real containment action |
| Dashboard | Simple HTML + Chart.js (reused pattern) | Visual, professor-friendly demo |
| CI | GitHub Actions or Jenkins | Reproducible build & tests |

### 8.2 Repository structure

```
cloudrdr/
├── src/
│   ├── monitor/          # file watcher + hashing
│   │   └── hasher.js
│   ├── baseline/         # baseline store + merkle root
│   │   └── baseline.js
│   ├── detection/        # change-rate + canary engine
│   │   └── engine.js
│   ├── response/         # freeze + incident creation
│   │   ├── freeze.js
│   │   └── incident.js
│   ├── backup/           # AES-GCM backup + restore + verify
│   │   ├── backup.js
│   │   └── restore.js
│   ├── crypto/           # key mgmt + signatures
│   │   └── keys.js
│   └── log/              # hash-chained, signed audit log
│       └── chainlog.js
├── sim/
│   └── ransomware-sim.js # benign mass-modification simulator
├── tests/                # unit tests (node:test)
├── docs/                 # ISMS package (see Section 9)
└── README.md
```

### 8.3 Implementation steps

1. **Sprint 1 — Storage & hashing.** Provision the bucket; implement
   `sha256File()`, baseline manifest and Merkle root; verify reproducibility.
2. **Sprint 2 — Monitoring & detection.** Watcher emits change events; engine
   computes rolling change-rate; canary files wired in; log output.
3. **Sprint 3 — Response & evidence.** Freeze routine (IAM deny-write), incident
   record creation, hash-chained log, Ed25519 signing.
4. **Sprint 4 — Backup & verified restore.** AES-256-GCM backup, signed
   manifest, restore + hash verification, VALID/MODIFIED reporting.
5. **Sprint 5 — Hardening & evaluation.** Distributed-safe rate limiting,
   failure modes, unit tests, demo script, metrics collection.

### 8.4 Testing strategy

- **Unit tests** (`node:test`) for every crypto function: round-trip
  encryption, tamper detection (`setAuthTag` mismatch), signature verification
  with a wrong key, and Merkle root sensitivity to a single byte change.
- **Detection tests** with synthetic workloads: 1%, 5%, 30%, 80% modification
  rates to plot the detection curve.
- **End-to-end test** using `sim/ransomware-sim.js`: baseline → simulate mass
  encryption → assert SUSPICIOUS → assert freeze → assert restore VALID.
- **Negatives:** a legitimate bulk job must *not* trigger a freeze (false
  positive test).

---

## 9. ISMS Mapping

This section is the "management system" spine of the project. Every technical
control in CloudRDR is traced to a recognised requirement.

### 9.1 Incident management (ISO/IEC 27001:2022 Clause 5.24–5.26)

| Requirement | CloudRDR artefact |
|---|---|
| 5.24 Planning and preparation for information security incident management | `docs/INCIDENT_RESPONSE_PLAN.md`; responder playbook (`src/response/`) |
| 5.25 Assessment of and decision on information security events | Detection engine verdict + confidence scoring |
| 5.26 Response to information security incidents | Automatic freeze, incident record, evidence sealing |
| 5.27 Learning from information security incidents | Post-incident review template; threshold tuning log |
| 5.28 Collection of evidence | Cryptographically sealed `evidence/` records |

### 9.2 Technical controls (ISO/IEC 27001:2022 Annex A)

| Annex A control | CloudRDR implementation |
|---|---|
| A.5.9 Inventory of information and other associated assets | Asset register of protected files and cloud resources |
| A.5.12 Classification of information | Data-classification labels on each file/prefix |
| A.5.13 Labelling of information | Prefix + metadata labels (`critical/`, `internal/`, `canary/`) |
| A.5.15 Access control | Per-prefix credentials; least privilege |
| A.5.16 Identity management | Distinct service identities for monitor / responder / backup |
| A.5.17 Authentication information | Managed secrets; no hard-coded credentials |
| A.5.23 Information security for use of cloud services | ISO 27017 shared-responsibility mapping |
| A.5.24–5.28 Incident management | See Section 9.1 |
| A.5.29 Information security during disruption | BCP/DRP (Section 9.3) |
| A.5.30 ICT readiness for business continuity | DR test: restore exercise is a rehearsal |
| A.8.10 Information deletion | Secure deletion policy for expired evidence |
| A.8.11 Data masking | Masking of sensitive identifiers in logs |
| A.8.12 Data leakage prevention | Evidence prefix locked; no public read |
| A.8.13 Information backup | Encrypted, signed, versioned backups |
| A.8.14 Redundancy of information processing facilities | Multi-region/replicated backup target |
| A.8.15 Logging | Hash-chained, signed audit log |
| A.8.16 Monitoring activities | Continuous change-rate monitoring + alerts |
| A.8.24 Use of cryptography | AES-256-GCM, SHA-256, Ed25519, key management policy |
| A.8.25 Secure development life cycle | Sprint-based build, code review |
| A.8.28 Secure coding | No hard-coded keys, fail-closed error handling |
| A.8.29 Security testing in development and acceptance | Unit + E2E + negative tests |

### 9.3 Business continuity and disaster recovery (NIST SP 800-34)

| Element | CloudRDR artefact |
|---|---|
| Business Impact Analysis (BIA) | RTO/RPO defined per data class |
| Recovery Time Objective (RTO) | Target ≤ 30 minutes to restore from backup |
| Recovery Point Objective (RPO) | Target ≤ 15 minutes of data loss |
| Continuity strategy | Immutable, isolated, encrypted backups |
| DR plan | `docs/DISASTER_RECOVERY_PLAN.md` with step-by-step restore runbook |
| Testing | Quarterly restore rehearsal; results recorded |

### 9.4 Risk assessment

A simple 5×5 likelihood × impact matrix is used. Example entries:

| ID | Risk | L | I | Score | Treatment | Residual |
|---|---|---|---|---|---|---|
| R1 | Ransomware encrypts cloud files | 4 | 5 | 20 | Detect + freeze + restore | 6 |
| R2 | Backup tampered before restore | 2 | 5 | 10 | Signed manifest + AEAD | 2 |
| R3 | Incident log altered to cover tracks | 2 | 4 | 8 | Hash chain + signature | 1 |
| R4 | Stolen IAM credential used for mass write | 4 | 4 | 16 | Least privilege + MFA + detection | 4 |
| R5 | Encryption key lost → data unrecoverable | 2 | 5 | 10 | Managed key store + backup of keys | 2 |
| R6 | False positive freezes production | 3 | 3 | 9 | Allow-list windows + tuning | 3 |

### 9.5 NIST CSF 2.0 function mapping

| Function | CloudRDR contribution |
|---|---|
| **Govern (GV)** | Security policies, risk register, roles, crypto policy |
| **Identify (ID)** | Asset register, classification, threat model |
| **Protect (PR)** | IAM least privilege, encryption, signing, immutability |
| **Detect (DE)** | Change-rate monitoring, canary tripwire, integrity checks |
| **Respond (RS)** | Automated freeze, incident record, evidence sealing |
| **Recover (RC)** | Verified restore, DR plan, post-incident review |

### 9.6 ISMS documentation deliverables

1. `docs/INCIDENT_RESPONSE_PLAN.md`
2. `docs/BUSINESS_CONTINUITY_PLAN.md`
3. `docs/DISASTER_RECOVERY_PLAN.md`
4. `docs/RISK_REGISTER.md`
5. `docs/ASSET_REGISTER.md`
6. `docs/EVIDENCE_HANDLING_POLICY.md`
7. `docs/CRYPTOGRAPHIC_POLICY.md`
8. `docs/CONTROL_MAPPING.csv` (machine-readable SoA extract)

---

## 10. Cloud Security Mapping

### 10.1 Shared-responsibility model

| Layer | Cloud provider | CloudRDR (customer) |
|---|---|---|
| Physical security | ✔ | — |
| Host/hypervisor | ✔ | — |
| Storage durability & replication | ✔ | — |
| Identity & access (IAM) | Shared | ✔ policy design, least privilege |
| Data classification | — | ✔ |
| Application-layer encryption | — | ✔ AES-256-GCM, key management |
| Backup configuration & immutability | Shared | ✔ retention lock, signed manifests |
| Monitoring & alerting | Shared | ✔ detection engine, alerting |
| Incident response | — | ✔ responder playbook |

This matrix directly supports ISO/IEC 27017 and ISO/IEC 27001 A.5.23.

### 10.2 IAM design

Three least-privilege principals — the core of the "account isolation" feature:

| Principal | Permissions |
|---|---|
| `svc-monitor` | Read-only on `files/`, `canary/`; write to baseline table |
| `svc-responder` | Modify IAM policy (freeze); write to `evidence/` |
| `svc-backup` | Read on `files/`; read/write on `backup/` only |

The **freeze** action replaces the compromised workload's policy with an
explicit `Deny` on write operations, applying the security principle of
**failing safe** (deny-by-default).

### 10.3 Cloud logging and monitoring

- **Storage access logs** are enabled and shipped to a central log store.
- **Cloud-native alerting** (e.g. CloudWatch / Supabase logs / Grafana) is wired
  to the detection verdicts.
- **Immutable log retention** prevents attacker log tampering at the cloud
  layer, complementing the application-level hash chain.

### 10.4 Network segmentation (conceptual)

In a full deployment, the monitor and responder run in separate
network/security zones with no inbound public access; only the dashboard is
exposed. East-west traffic between components is authenticated and minimised.

---

## 11. Cryptography Mapping

### 11.1 Algorithm choices and justification

| Purpose | Algorithm | Standard | Why |
|---|---|---|---|
| File integrity | SHA-256 | FIPS 180-4 | Collision-resistant, fast, ubiquitous |
| Tamper-evidence | Hash chaining (SHA-256) | — | Cheap, verifiable ordering |
| Backup confidentiality + integrity | AES-256-GCM | SP 800-38D | AEAD: one primitive gives both |
| Evidence non-repudiation | Ed25519 (or ECDSA P-256) | FIPS 186-5 | Small keys, fast verify, strong security |
| Key derivation | HKDF / PBKDF2 | SP 800-108 / RFC 8018 | Derive sub-keys from a master secret |
| Randomness | CSPRNG (`crypto.randomBytes`) | — | Correct nonce/IV and key generation |
| Comparison | Constant-time equality | — | Avoid timing side channels |

### 11.2 Key management

- Keys are generated with a CSPRNG and stored in a **managed secret store**
  (never in source code or plain environment fallbacks).
- A **master key** wraps data-encryption keys (**envelope encryption**),
  allowing rotation without re-encrypting all data at once.
- **Rotation schedule** is defined in the Cryptographic Policy (e.g. data keys
  every 90 days, signing keys annually).
- Every ciphertext and signature records its **key version**, so old data
  remains decryptable after rotation (crypto-agility).
- **Compromise procedure** is documented: revoke, re-key, re-encrypt, re-sign.

### 11.3 Cryptographic threat-considerations

| Threat | Mitigation |
|---|---|
| Nonce reuse in GCM | Fresh random 96-bit nonce per encryption; never reuse with the same key |
| Hash collision / length-extension attacks | Use SHA-256 over well-defined serialisation; for authentication use HMAC, not bare hash |
| Signature forgery | Verify with the correct public key; bind signature to the full manifest |
| Key exposure | Managed store, least privilege, rotation, no logging of key material |
| Downgrade / weak params | Policy-enforced algorithm allow-list (Section 9.6 Cryptographic Policy) |
| Quantum (future) | Crypto-agility path toward ML-DSA/ML-KEM (Section 16) |

### 11.4 What makes the cryptography meaningful (vs. "we use AES")

The project does not merely state an algorithm name. It demonstrates:

1. **A verifiable integrity property** — a single flipped byte changes the
   Merkle root and fails verification.
2. **A verifiable authenticity property** — an edited incident record fails
   signature verification and breaks the hash chain.
3. **A verifiable recovery property** — a restored file is declared VALID only
   after independent re-hashing, not on trust.
4. **A verifiable confidentiality property** — the AEAD tag proves the stored
   backup was not silently altered.

---

## 12. Demonstration Scenario

The demo is designed to be **repeatable, visual and fast** (under five minutes).

**Setup.** 100 protected files are seeded into `files/`, plus 3 canary files.
The baseline is computed and the Merkle root is stored and signed.

**Step 1 — Normal activity (control).**
A script modifies 3 files. The change-rate is 3% — below the 30% threshold. The
system reports **NORMAL** and takes no action. *(This proves the system is not
trigger-happy.)*

**Step 2 — Legitimate bulk job (control).**
A simulated backup job modifies 25 files over 2 minutes. Because the rolling
30-second rate stays below threshold (and/or the job identity is allow-listed),
the system still reports **NORMAL**.

**Step 3 — Simulated ransomware attack.**
`sim/ransomware-sim.js` overwrites 82 files within ~10 seconds (and touches a
canary file). The change-rate jumps to 82% with a canary hit → the engine
returns **SUSPICIOUS** with confidence ≈ 1.0.

**Step 4 — Automated response.**
The responder:
- applies the deny-write IAM policy → the simulated attacker's further writes
  fail;
- snapshots the corrupted state to `evidence/`;
- writes and **signs** incident `INC-2026-0001`, chained to the previous hash.

**Step 5 — Verified recovery.**
The backup service restores all files from the AES-256-GCM backups, then the
verifier re-hashes every restored file and recomputes the Merkle root.

**Step 6 — Proof of integrity.**

```
Evidence file:      files/report_q3.pdf
Baseline SHA-256:   a3f1...9c
Restored SHA-256:   a3f1...9c
Merkle root match:  YES
Integrity:          VALID ✅
```

**Step 7 — Tamper test (proof of tamper-evidence).**
Manually edit one byte of `evidence/INC-2026-0001.json` and re-run verification.
The signature check fails and the hash chain breaks:

```
Chain verification: FAILED ❌  (entry 1 prevHash mismatch)
Signature:          INVALID ❌
```

This single step is the most persuasive part of the demo, because it makes the
cryptography *visible*.

**Demo artefacts produced:**

| Artefact | Purpose |
|---|---|
| Detection timeline chart | Shows change-rate vs threshold |
| Signed incident record | Demonstrates non-repudiation |
| Restore verification report | Demonstrates integrity |
| Tamper-test output | Demonstrates tamper-evidence |

---

## 13. Evaluation and Success Metrics

### 13.1 Metrics

| # | Metric | Target | How measured |
|---|---|---|---|
| M1 | Detection rate (true positive) | ≥ 95% for ≥30% modification events | Synthetic runs at known rates |
| M2 | False-positive rate | ≤ 5% on normal/bulk workloads | Control runs (Steps 1–2) |
| M3 | Time-to-detect | ≤ 60 s from attack start | Timestamp delta |
| M4 | Freeze effectiveness | 100% of post-freeze writes denied | Attempted writes after freeze |
| M5 | Backup integrity | 100% pass of AEAD tag verification | Restore test on untouched backup |
| M6 | Restore correctness | 100% of files VALID | Hash comparison vs baseline |
| M7 | Tamper detection | 100% of edited records flagged | Deliberate mutations |
| M8 | Test coverage of crypto modules | 100% of public functions tested | `node:test` report |
| M9 | Control mapping completeness | ≥ 90% of applicable Annex A controls evidenced | SoA review |

### 13.2 Evaluation method (answers RQ1)

A small experiment sweeps the modification rate (1%, 5%, 10%, 20%, 30%, 50%,
80%) and records the detector verdict, producing a **receiver-operating-style
curve**: detection rate vs. false-positive rate at the chosen threshold. The
result demonstrates the trade-off and justifies the selected threshold.

### 13.3 Expected results

- The detector separates legitimate activity from attack rate reliably at the
  chosen threshold, with a clearly explained false-positive handling strategy.
- Every cryptographic property (integrity, authenticity, confidentiality,
  tamper-evidence) is demonstrated with a pass/fail test rather than a claim.
- The control mapping shows that each implemented technical measure satisfies a
  named ISMS requirement, and the risk register shows measured residual risk.

---

## 14. Timeline and Milestones

A 12-week plan aligned to a single semester.

| Week | Milestone | Deliverable |
|---|---|---|
| 1 | Kick-off, scope, requirements, threat model | `THREAT_MODEL.md` |
| 2 | ISMS gap assessment and risk register v1 | `RISK_REGISTER.md` |
| 3–4 | Storage provisioning + baseline hashing + Merkle root | `src/baseline/` + tests |
| 5 | Monitoring agent (change events) | `src/monitor/` |
| 6–7 | Detection engine (rate + canary) + tuning experiment | `src/detection/` + detection curve |
| 8 | Automated response (freeze) + incident records + signing | `src/response/` |
| 9 | Hash-chained, signed audit log | `src/log/` |
| 10 | AES-256-GCM backup + verified restore | `src/backup/` + tests |
| 11 | End-to-end demo + metrics + negative tests | Demo script + results |
| 12 | ISMS documentation pack, final report, presentation | Full docs + report |

**Critical path:** baseline hashing → detection engine → response → backup/restore.
The ISMS documentation runs in parallel from week 2, because it does not depend
on finished code.

---

## 15. Risks, Assumptions and Limitations

### 15.1 Project risks

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Cloud provider free-tier limits | Medium | Medium | Local S3-compatible emulation (MinIO) as fallback |
| Threshold tuning takes longer than expected | Medium | Medium | Simple, explainable rule; timebox tuning to one week |
| Scope creep (adding entropy analysis, dashboards) | Medium | High | Freeze scope; move extras to Future Work (Section 16) |
| Losing the encryption key during development | High | Low | Store keys in a documented, backed-up secret store from day 1 |
| Environment/free-tier expiry before the demo | High | Low | Local emulation mode guaranteed to work offline |

### 15.2 Assumptions

- The cloud storage provider supports versioning, object lock/immutability and
  IAM policy changes (all mainstream providers do).
- The monitoring agent has read access to protected files and can compute
  hashes without excessive cost.
- The attacker's mass-write pattern is a genuine, detectable departure from
  normal activity within a short window.

### 15.3 Limitations (stated honestly)

- **Detection is heuristic, not perfect.** A slow, low-rate ("low-and-slow")
  ransomware that encrypts a few files per minute could evade a rate-based
  detector. Entropy analysis or behavioural baselining is future work.
- **The prototype is single-tenant.** Multi-tenant key separation is Future
  Work.
- **Hardware-backed key storage** (HSM/KMS) is represented by a managed secret
  store in the prototype, not a physical HSM.
- **The ransomware simulator is benign**, so results characterise the *detector*
  rather than a real malware family's behaviour.
- **Legal admissibility** of evidence is not proven; only the technical
  properties (integrity, authenticity, tamper-evidence) are demonstrated.

---

## 16. Future Work

1. **Entropy-based detection.** Compute Shannon entropy of changed files and add
   it as a second, high-confidence signal.
2. **Behavioural baselining / ML.** Learn each file's normal modification
   profile to reduce false positives further.
3. **Multi-tenant isolation with per-tenant keys.** Separate keys and buckets per
   tenant.
4. **Hardware-backed key management.** Integrate a real cloud KMS/HSM with
   envelope encryption.
5. **Crypto-agility and post-quantum readiness.** Abstract the signature and KEM
   layer so it can migrate to ML-DSA (FIPS 204) and ML-KEM (FIPS 203).
6. **Automated containment orchestration.** Extend the freeze to full
   SOAR-style playbooks (isolate host, rotate all credentials, notify).
7. **Immutable external anchoring.** Periodically anchor the hash chain root to
   an append-only external ledger for stronger tamper-evidence over time.
8. **Regulatory alignment.** Extend the mapping to GDPR/PCI-DSS where relevant.

---

## 17. References

1. ISO/IEC 27001:2022 — *Information security, cybersecurity and privacy
   protection — Information security management systems — Requirements*.
2. ISO/IEC 27017:2015 — *Code of practice for information security controls
   based on ISO/IEC 27002 for cloud services*.
3. NIST (2024) — *The NIST Cybersecurity Framework (CSF) 2.0*, NIST CSWP 29.
4. NIST SP 800-61 Rev. 2 — *Computer Security Incident Handling Guide*.
5. NIST SP 800-34 Rev. 1 — *Contingency Planning Guide for Federal Information
   Systems*.
6. NIST SP 800-57 Part 1 Rev. 5 — *Recommendation for Key Management*.
7. NIST SP 800-38D — *Recommendation for Block Cipher Modes of Operation:
   GCM and GMAC*.
8. NIST FIPS 180-4 — *Secure Hash Standard (SHS)*.
9. NIST FIPS 186-5 — *Digital Signature Standard (DSS)*.
10. NIST FIPS 203 / 204 / 205 (2024) — ML-KEM / ML-DSA / SLH-DSA.
11. RFC 9106 — *Argon2 Memory-Hard Function for Password Hashing*.
12. RFC 8018 — *PKCS #5: Password-Based Cryptography Specification v2.1*.
13. OWASP — *Application Security Verification Standard (ASVS)* and *Top 10*.
14. NIST SP 800-145 — *The NIST Definition of Cloud Computing*.

---

## Appendix A — Mapping Summary (one page)

| Course | Key concept demonstrated | Evidence in project |
|---|---|---|
| **ISMS** | Incident management, BCP/DRP, risk assessment, asset classification, evidence handling | Sections 9.1–9.6, `docs/*` ISMS pack |
| **Cloud Security** | IAM least privilege, account isolation, immutable storage, cloud logging, shared responsibility | Sections 10.1–10.4, `src/response/freeze.js` |
| **Cryptography** | SHA-256, Merkle/hash chaining, Ed25519 signatures, AES-256-GCM AEAD, key management | Sections 7.2, 7.5, 7.6, 11 |

**One-sentence summary:** CloudRDR detects ransomware-style mass modification
of cloud files, isolates the affected account, and restores data from encrypted,
signed backups — proving, with SHA-256 hashes, digital signatures and AEAD, that
both the evidence and the recovered data are authentic and unmodified.

---

*End of report.*