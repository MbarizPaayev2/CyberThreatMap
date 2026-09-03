// Strict 4 Severity Colors used across entire platform
export const SEVERITY_COLORS = {
  "critical": "#E11D48", // Crimson Red
  "high":     "#F97316", // Amber Orange
  "medium":   "#F59E0B", // Golden Yellow
  "low":      "#3B82F6", // Muted Slate Blue
};

// Dedicated Confidence Color Language for Threat Intelligence (Separate semantic system)
export const CONFIDENCE_COLORS = {
  "Confirmed": "#E11D48", // Red
  "High":      "#F97316", // Orange
  "Medium":    "#F59E0B", // Yellow
  "Low":       "#64748B", // Gray
};

export const getSeverityColor = (sev) => SEVERITY_COLORS[sev?.toLowerCase()] || SEVERITY_COLORS["low"];
export const getConfidenceColor = (conf) => CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS["Low"];

// Expanded SOC Attack Type Taxonomy with Min Severities, Weights and Typical Severities
export const ATTACK_METADATA = {
  "Zero-Day Exploit":          { code: "0DAY", minSeverity: "critical", weight: 2,  typicalSeverity: "critical", color: "#E11D48" },
  "Ransomware":                { code: "RNM", minSeverity: "high",     weight: 2,  typicalSeverity: "critical", color: "#E11D48" },
  "Command Injection":         { code: "CMD", minSeverity: "medium",   weight: 1.5, typicalSeverity: "critical", color: "#E11D48" },
  "DDoS":                      { code: "DDS", minSeverity: "medium",   weight: 25,  typicalSeverity: "high",     color: "#F97316" },
  "SQL Injection":             { code: "SQL", minSeverity: "medium",   weight: 3,   typicalSeverity: "high",     color: "#F97316" },
  "Man-in-the-Middle":         { code: "MITM", minSeverity: "medium",  weight: 0.5, typicalSeverity: "high",     color: "#F97316" },
  "Brute Force":               { code: "BRU", minSeverity: "medium",   weight: 12,  typicalSeverity: "medium",   color: "#F59E0B" },
  "Credential Stuffing":       { code: "CRD", minSeverity: "medium",   weight: 8,   typicalSeverity: "medium",   color: "#F59E0B" },
  "Phishing":                  { code: "PHI", minSeverity: "medium",   weight: 4,   typicalSeverity: "medium",   color: "#8B5CF6" },
  "Cross-Site Scripting (XSS)":{ code: "XSS", minSeverity: "low",      weight: 0.5, typicalSeverity: "medium",   color: "#F59E0B" },
  "API Abuse":                 { code: "API", minSeverity: "low",      weight: 0.5, typicalSeverity: "medium",   color: "#F59E0B" },
  "DNS Tunneling":             { code: "DNS", minSeverity: "low",      weight: 1.0, typicalSeverity: "low",      color: "#3B82F6" },
  "Port Scan":                 { code: "POR", minSeverity: "low",      weight: 30,  typicalSeverity: "low",      color: "#3B82F6" },
  "Malware":                   { code: "MAL", minSeverity: "medium",   weight: 10,  typicalSeverity: "high",     color: "#38BDF8" }
};

export const ATTACK_TYPES = Object.keys(ATTACK_METADATA);

export const ATTACK_CODES = Object.fromEntries(
  Object.entries(ATTACK_METADATA).map(([k, v]) => [k, v.code])
);

export const getAttackCode = (type) => ATTACK_METADATA[type]?.code || "UNK";
export const getTypicalSeverity = (type) => ATTACK_METADATA[type]?.typicalSeverity || "medium";
export const getAttackTypeColor = (type) => ATTACK_METADATA[type]?.color || "#38BDF8";
