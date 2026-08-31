/*
 * Firestore data models.
 *
 * These are deliberately plain JavaScript objects so they can be used by the
 * current static web app and by the Node.js migration script alike. All model
 * factories return frozen objects and normalize values coming from Sheets.
 */
(function attachAppModels(global) {
  'use strict';

  const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';

  function text(value, fallback = '') {
    return hasValue(value) ? String(value).trim() : fallback;
  }

  function nullableText(value) {
    const result = text(value);
    return result || null;
  }

  function number(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function date(value, fallback = null) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value);
    if (!hasValue(value)) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  function isPublic(value, fallback = true) {
    if (!hasValue(value)) return fallback;
    return !['n', 'no', 'false', '0', '숨김', '비공개'].includes(String(value).trim().toLowerCase());
  }

  function boolean(value, fallback = false) {
    if (!hasValue(value)) return fallback;
    if (typeof value === 'boolean') return value;
    return !['n', 'no', 'false', '0', '대기', '미답변'].includes(String(value).trim().toLowerCase());
  }

  function array(value) {
    if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean);
    return text(value).split(/[|,]/).map(item => item.trim()).filter(Boolean);
  }

  function freeze(model) {
    return Object.freeze(model);
  }

  const models = {
    consultation(value = {}) {
      return freeze({
        id: text(value.id),
        createdAt: date(value.createdAt ?? value.date),
        category: text(value.category),
        nickname: text(value.nickname, '익명'),
        title: text(value.title),
        question: text(value.question),
        answer: text(value.answer),
        answered: boolean(value.answered, Boolean(text(value.answer))),
      });
    },

    consultationCategory(value = {}) {
      return freeze({
        name: text(value.name ?? value.category),
        isPublic: isPublic(value.isPublic ?? value.use),
      });
    },

    notice(value = {}) {
      return freeze({
        category: text(value.category ?? value.cat),
        title: text(value.title),
        content: text(value.content),
        attachmentTitle: array(value.attachmentTitle ?? value.attachTitle),
        attachmentUrl: array(value.attachmentUrl ?? value.attachLink),
        publishedAt: date(value.publishedAt ?? value.date, new Date()),
        isPublic: isPublic(value.isPublic ?? value.use),
      });
    },

    faq(value = {}) {
      return freeze({
        category: text(value.category ?? value.cat),
        question: text(value.question ?? value.q),
        answer: text(value.answer ?? value.a),
        isPublic: isPublic(value.isPublic ?? value.use),
      });
    },

    kciLog(value = {}) {
      return freeze({
        occurredAt: date(value.occurredAt ?? value.time, new Date()),
        type: text(value.type),
        query: text(value.query),
        result: text(value.result),
        durationMs: number(value.durationMs ?? value.elapsedMs ?? value['걸린시간(ms)']),
        payload: value.payload ?? value.fullPayload ?? value['전달된 값 전체'] ?? null,
      });
    },

    apiUsage(value = {}) {
      return freeze({
        occurredAt: date(value.occurredAt ?? value.date, new Date()),
        model: text(value.model),
        inputTokens: number(value.inputTokens ?? value['입력토큰']),
        outputTokens: number(value.outputTokens ?? value['출력토큰']),
        reasoningTokens: number(value.reasoningTokens ?? value.thinkingTokens ?? value['생각토큰']),
        totalTokens: number(value.totalTokens ?? value['합계토큰']),
        costUsd: number(value.costUsd ?? value['요금(USD)']),
        costKrw: number(value.costKrw ?? value['환산(원)']),
        durationMs: number(value.durationMs ?? value['소요(ms)']),
      });
    },
  };

  global.AppModels = Object.freeze(models);
  if (typeof module !== 'undefined' && module.exports) module.exports = global.AppModels;
}(typeof window !== 'undefined' ? window : globalThis));
