const SENSITIVE_FIELD_NAMES = new Set([
  "auth",
  "authdata",
  "authentication",
  "authenticationdata",
  "authorization",
  "authorizationheader",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "encryptionkey",
  "mfa",
  "mfasecret",
  "onetimepassword",
  "otp",
  "passcode",
  "passphrase",
  "password",
  "passwordhash",
  "pin",
  "privatekey",
  "session",
  "sessionid",
]);

const PAYMENT_FIELD_NAMES = new Set([
  "accountnumber",
  "amount",
  "bankaccount",
  "card",
  "cardnumber",
  "creditcard",
  "currency",
  "cvc",
  "cvv",
  "debitcard",
  "expiration",
  "expirationdate",
  "expiry",
  "expirydate",
  "iban",
  "payment",
  "paymentdata",
  "paymentdetails",
  "paymentmethod",
  "routingnumber",
  "swift",
  "transactionid",
]);

const OBSERVATION_MECHANICS_FIELD_NAMES = new Set([
  "body",
  "clientx",
  "clienty",
  "clipboard",
  "clipboardtext",
  "clickposition",
  "code",
  "coordinate",
  "coordinates",
  "copiedmessagebody",
  "copiedtext",
  "cssselector",
  "dompath",
  "key",
  "keyboardinput",
  "keycode",
  "keypress",
  "keypressed",
  "keystroke",
  "keystrokes",
  "mouseposition",
  "pagex",
  "pagey",
  "position",
  "rawbody",
  "rawkey",
  "rawkeys",
  "rawmessagebody",
  "scancode",
  "screenx",
  "screeny",
  "selector",
  "x",
  "xpath",
  "y",
]);

const UNSAFE_OBJECT_FIELD_NAMES = new Set([
  "constructor",
  "prototype",
  "__proto__",
]);

const SENSITIVE_STRING_PATTERNS = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/i,
  /\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}\b/i,
  /\b(?:api[_ -]?key|authorization|passcode|password|secret|token)\s*[:=]\s*\S+/i,
  /\b(?:\d[ -]*?){13,19}\b/,
];

function normalizeFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveFieldName(fieldName: string): boolean {
  const normalizedName = normalizeFieldName(fieldName);

  return (
    SENSITIVE_FIELD_NAMES.has(normalizedName) ||
    PAYMENT_FIELD_NAMES.has(normalizedName) ||
    OBSERVATION_MECHANICS_FIELD_NAMES.has(normalizedName) ||
    normalizedName.endsWith("apikey") ||
    normalizedName.endsWith("credential") ||
    normalizedName.endsWith("credentials") ||
    normalizedName.endsWith("password") ||
    normalizedName.endsWith("secret") ||
    normalizedName.endsWith("token")
  );
}

function containsSensitiveString(value: string): boolean {
  return SENSITIVE_STRING_PATTERNS.some((pattern) => pattern.test(value));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function redactValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  if (typeof value === "string") {
    return containsSensitiveString(value) ? undefined : value;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return undefined;
    }

    ancestors.add(value);
    const redactedArray = value
      .map((item) => redactValue(item, ancestors))
      .filter((item) => item !== undefined);
    ancestors.delete(value);
    return value.length > 0 && redactedArray.length === 0
      ? undefined
      : redactedArray;
  }

  if (!isPlainRecord(value) || ancestors.has(value)) {
    return undefined;
  }

  ancestors.add(value);
  const redactedRecord: Record<string, unknown> = {};

  for (const fieldName of Object.keys(value).sort()) {
    if (
      UNSAFE_OBJECT_FIELD_NAMES.has(fieldName) ||
      isSensitiveFieldName(fieldName)
    ) {
      continue;
    }

    const redactedValue = redactValue(value[fieldName], ancestors);
    if (redactedValue !== undefined) {
      redactedRecord[fieldName] = redactedValue;
    }
  }

  ancestors.delete(value);
  return Object.keys(value).length > 0 &&
    Object.keys(redactedRecord).length === 0
    ? undefined
    : redactedRecord;
}

export function redactPayload(
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const redactedPayload = redactValue(payload, new WeakSet());
  return isPlainRecord(redactedPayload) ? redactedPayload : {};
}
