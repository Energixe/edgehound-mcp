export function truncate(text, maxLen) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

export function isValidEmail(email) {
  if (email.includes("+")) return false;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
}

export function monthlyPrice(annualCents, months = 12) {
  return annualCents / months / 100;
}

export function parseDuration(input) {
  const match = input.match(/(\d+)(h|m|s)/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "h") return value * 3600;
  if (unit === "m") return value * 60;
  return value;
}
