const PLAY_SEPARATOR = "§";

const PLAY_FIELDS = [
  "deckId",
  "userId",
  "date",
  "rank",
  "suit",
  "action",
  "authorized",
  "flow",
  "recipients",
];

const MOTHER_RANKS = new Set(["A", "J", "K"]);
const CHILD_RANKS = new Set(["Q"]);

function safeTrim(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeEmpty(value) {
  const v = safeTrim(value);
  return v === "" ? null : v;
}

function normalizeRank(rank) {
  const value = safeTrim(rank).toUpperCase();
  return value || null;
}

function normalizeSuit(suit) {
  const value = safeTrim(suit).toUpperCase();
  return value || null;
}

function splitPlayCode(playCode) {
  if (typeof playCode !== "string") {
    throw new Error("play_code debe ser un string");
  }

  const raw = playCode.trim();
  if (!raw) {
    throw new Error("play_code vacío");
  }

  const parts = raw.split(PLAY_SEPARATOR);

  if (parts.length > PLAY_FIELDS.length) {
    throw new Error(
      `play_code inválido: se esperaban como máximo ${PLAY_FIELDS.length} segmentos y llegaron ${parts.length}`
    );
  }

  while (parts.length < PLAY_FIELDS.length) {
    parts.push("");
  }

  return parts;
}

function parsePlayCode(playCode) {
  const parts = splitPlayCode(playCode);

  const parsed = {
    raw: playCode,
    deckId: normalizeEmpty(parts[0]),
    userId: normalizeEmpty(parts[1]),
    date: normalizeEmpty(parts[2]),
    rank: normalizeRank(parts[3]),
    suit: normalizeSuit(parts[4]),
    action: normalizeEmpty(parts[5]),
    authorized: normalizeEmpty(parts[6]),
    flow: normalizeEmpty(parts[7]),
    recipients: normalizeEmpty(parts[8]),
  };

  parsed.isMother = MOTHER_RANKS.has(parsed.rank);
  parsed.isChild = CHILD_RANKS.has(parsed.rank);
  parsed.cardKey = parsed.rank && parsed.suit ? `${parsed.rank}${parsed.suit}` : null;

  return parsed;
}

function validateParsedPlay(parsed) {
  const errors = [];

  if (!parsed.deckId) errors.push("Falta deckId");
  if (!parsed.rank) errors.push("Falta rank");
  if (!parsed.suit) errors.push("Falta suit");

  const validRanks = new Set(["A", "J", "Q", "K"]);
  if (parsed.rank && !validRanks.has(parsed.rank)) {
    errors.push(`Rank inválido: ${parsed.rank}`);
  }

  const validSuits = new Set([
    "HEART",
    "DIAMOND",
    "CLUB",
    "SPADE",
    "JOKER",
    "BLACK",
    "RED",
    "BLUE",
  ]);

  if (parsed.suit && !validSuits.has(parsed.suit)) {
    errors.push(`Suit inválido: ${parsed.suit}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function parseAndValidatePlayCode(playCode) {
  const parsed = parsePlayCode(playCode);
  const validation = validateParsedPlay(parsed);

  return {
    ...parsed,
    ok: validation.ok,
    errors: validation.errors,
  };
}

module.exports = {
  PLAY_SEPARATOR,
  PLAY_FIELDS,
  parsePlayCode,
  validateParsedPlay,
  parseAndValidatePlayCode,
};
