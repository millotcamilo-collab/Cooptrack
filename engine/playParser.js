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
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseFlowChunks(flowValue) {
  const raw = normalizeEmpty(flowValue);
  if (!raw) return [];

  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFlowMetadata(flowValue) {
  const chunks = parseFlowChunks(flowValue);

  const meta = {
    chunks,
    baseFlow: '',
    finalTargetUserId: null,
  };

  chunks.forEach((chunk) => {
    if (chunk.startsWith('finalTarget:U:')) {
      const userId = Number(chunk.replace('finalTarget:U:', ''));

      if (Number.isInteger(userId) && userId > 0) {
        meta.finalTargetUserId = userId;
      }

      return;
    }

    if (!meta.baseFlow) {
      meta.baseFlow = chunk;
    }
  });

  return meta;
}

function getCardFamily(rank) {
  switch (rank) {
    case 'A': return 'ACE';
    case 'K': return 'KING';
    case 'J': return 'JACK';
    case 'Q': return 'QUEEN';
    case 'JOKER': return 'JOKER';
    default: return null;
  }
}

function isValidDateString(value) {
  if (!value) return true;
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

  parsed.flowMeta = parseFlowMetadata(parsed.flow);
  parsed.finalTargetUserId = parsed.flowMeta.finalTargetUserId;

  parsed.family = getCardFamily(parsed.rank);
  parsed.cardKey = parsed.rank && parsed.suit ? `${parsed.rank}${parsed.suit}` : null;

  parsed.isAce = parsed.rank === 'A';
  parsed.isKing = parsed.rank === 'K';
  parsed.isJack = parsed.rank === 'J';
  parsed.isQueen = parsed.rank === 'Q';
  parsed.isJoker = parsed.rank === 'JOKER';

  parsed.isMother = ['A', 'J', 'K'].includes(parsed.rank);
  parsed.isChild = parsed.rank === 'Q';

  parsed.authorizedList = parseList(parsed.authorized);
  parsed.recipientList = parseList(parsed.recipients);

  return parsed;
}

function validateFlowMetadata(parsed, errors) {
  const chunks = parsed.flowMeta?.chunks || [];

  chunks.forEach((chunk) => {
    if (chunk.startsWith('finalTarget:U:')) {
      const rawId = chunk.replace('finalTarget:U:', '');
      const userId = Number(rawId);

      if (!Number.isInteger(userId) || userId <= 0) {
        errors.push(`finalTarget inválido: ${chunk}`);
      }

      return;
    }

    // dejamos pasar flows existentes:
    // acl, foundation, admin, pay:QHEART..., settlement:...
  });
}

function validateParsedPlay(parsed) {
  const errors = [];

  const validRanks = new Set(['A', 'J', 'Q', 'K', 'JOKER']);
  const validSuits = new Set(['HEART', 'SPADE', 'DIAMOND', 'CLUB', 'RED', 'BLUE']);

  if (!parsed.deckId) errors.push('Falta deckId');
  if (!parsed.rank) errors.push('Falta rank');
  if (!parsed.suit) errors.push('Falta suit');

  if (parsed.rank && !validRanks.has(parsed.rank)) {
    errors.push(`Rank inválido: ${parsed.rank}`);
  }

  if (parsed.suit && !validSuits.has(parsed.suit)) {
    errors.push(`Suit inválido: ${parsed.suit}`);
  }

  if (parsed.rank === 'JOKER' && parsed.suit && !['RED', 'BLUE'].includes(parsed.suit)) {
    errors.push(`JOKER solo admite suit RED o BLUE, llegó: ${parsed.suit}`);
  }

  if (
    parsed.rank &&
    parsed.rank !== 'JOKER' &&
    parsed.suit &&
    ['RED', 'BLUE'].includes(parsed.suit)
  ) {
    errors.push(`${parsed.rank} no admite suit ${parsed.suit}`);
  }

  if (parsed.date && !isValidDateString(parsed.date)) {
    errors.push(`Fecha inválida: ${parsed.date}`);
  }

  validateFlowMetadata(parsed, errors);

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