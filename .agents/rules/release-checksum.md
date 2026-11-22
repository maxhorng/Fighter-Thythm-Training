---
trigger: always_on
description: Always include SHA-256 checksums when building or publishing release binaries (.exe) to GitHub Releases.
---

# Release Checksum Rule

Whenever building or publishing a release binary (such as `release/*.exe`) or creating/updating a GitHub Release:
1. Compute the **SHA-256** checksum of the built `.exe` file (e.g., via PowerShell `(Get-FileHash <file> -Algorithm SHA256).Hash`).
2. Include the SHA-256 checksum clearly in the GitHub Release Notes so users can verify the binary has not been tampered with.
3. Also report the SHA-256 checksum to the user in the final response.
