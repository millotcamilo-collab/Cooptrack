const PLAY_SEPARATOR = '§';

function safeTrim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeEmpty(value) {
  const v = safeTrim(value);
  return v === '' ? null : v;
}

function normalizeRank(rank) {
  const value = safeTrim(rank).toUpperCase();
  return value || null;
}

function normalizeSuit(suit) {
  const value = safeTrim(suit).toUpperCase();
  return value || null;
}

function parseList(value) {
  const raw = normalizeEmpty(value);
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCardFamily(rank) {
  switch (rank) {
    case 'A':
      return 'ACE';
    case 'K':
      return 'KING';
    case 'J':
      return 'JACK';
    case 'Q':
      return 'QUEEN';
    case 'JOKER':
      return 'JOKER';
    default:
      return null;
  }
}

function isValidDateString(value) {
  if (!value) return true; // si no viene fecha, no falla acá
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function parsePlayCode(playCode) {
  if (typeof playCode !== 'string') {
    throw new Error('play_code debe ser un string');
  }

  const raw = playCode.trim();

  if (!raw) {
    throw new Error('play_code vacío');
  }

  const parts = raw.split(PLAY_SEPARATOR);

  while (parts.length < 9) {
    parts.push('');
  }

  if (parts.length > 9) {
    throw new Error(`play_code inválido: tiene ${parts.length} segmentos`);
  }

  const parsed = {
    raw: playCode,

    // Campos base
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

  // Metadatos derivados
  parsed.family = getCardFamily(parsed.rank);
  parsed.cardKey = parsed.rank && parsed.suit ? `${parsed.rank}${parsed.suit}` : null;

  // Flags prácticos
  parsed.isAce = parsed.rank === 'A';
  parsed.isKing = parsed.rank === 'K';
  parsed.isJack = parsed.rank === 'J';
  parsed.isQueen = parsed.rank === 'Q';
  parsed.isJoker = parsed.rank === 'JOKER';

  // Según el modelo actual:
  // A, J y K pueden actuar como líneas madre
  // Q es jugada hija
  parsed.isMother = ['A', 'J', 'K'].includes(parsed.rank);
  parsed.isChild = parsed.rank === 'Q';

  // Listas parseadas para usar más fácil en el engine
  parsed.authorizedList = parseList(parsed.authorized);
  parsed.recipientList = parseList(parsed.recipients);

  return parsed;
}

function validateParsedPlay(parsed) {
  const errors = [];

  const validRanks = new Set(['A', 'J', 'Q', 'K', 'JOKER']);
  const validSuits = new Set(['HEART', 'SPADE', 'DIAMOND', 'CLUB', 'RED', 'BLUE']);

  // Validaciones obligatorias mínimas
  if (!parsed.deckId) errors.push('Falta deckId');
  if (!parsed.rank) errors.push('Falta rank');
  if (!parsed.suit) errors.push('Falta suit');

  // Validación de valores permitidos
  if (parsed.rank && !validRanks.has(parsed.rank)) {
    errors.push(`Rank inválido: ${parsed.rank}`);
  }

  if (parsed.suit && !validSuits.has(parsed.suit)) {
    errors.push(`Suit inválido: ${parsed.suit}`);
  }

  // Regla: JOKER solo puede usar RED o BLUE
  if (parsed.rank === 'JOKER' && parsed.suit && !['RED', 'BLUE'].includes(parsed.suit)) {
    errors.push(`JOKER solo admite suit RED o BLUE, llegó: ${parsed.suit}`);
  }

  // Regla: A, J, K, Q no pueden usar RED o BLUE
  if (
    parsed.rank &&
    parsed.rank !== 'JOKER' &&
    parsed.suit &&
    ['RED', 'BLUE'].includes(parsed.suit)
  ) {
    errors.push(`${parsed.rank} no admite suit ${parsed.suit}`);
  }

  // Validación básica de fecha
  if (parsed.date && !isValidDateString(parsed.date)) {
    errors.push(`Fecha inválida: ${parsed.date}`);
  }

  // Regla mínima: si es Q, debería tener al menos alguna señal de relación
  // con terceros o flujo. No reemplaza la validación institucional del engine,
  // pero evita Q totalmente vacías de sentido operativo.
  if (parsed.rank === 'Q') {
    const hasSomeRelation =
      parsed.recipientList.length > 0 ||
      parsed.authorizedList.length > 0 ||
      !!parsed.flow ||
      !!parsed.action;

    if (!hasSomeRelation) {
      errors.push('Una Q debería incluir action, flow, authorized o recipients');
    }
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
  parsePlayCode,
  validateParsedPlay,
  parseAndValidatePlayCode,
};
