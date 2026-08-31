/* eslint-disable */
/**
 * Import the Google Sheets data into Firestore.
 *
 * Required environment variables:
 *   GOOGLE_APPLICATION_CREDENTIALS - service-account JSON path
 *   GOOGLE_SHEETS_SPREADSHEET_ID   - spreadsheet ID from the Sheets URL
 *
 * Optional sheet-name overrides:
 *   SHEET_CONSULTATIONS, SHEET_CATEGORIES, SHEET_NOTICES, SHEET_FAQ,
 *   SHEET_KCI_LOGS, SHEET_API_USAGE, SHEET_RAG_VECTOR_INDEX
 *
 * Run from the functions directory:
 *   npm run migrate:sheets
 */
const crypto = require('node:crypto');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const models = require('../js/models.js');

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID 환경변수가 필요합니다.');
}

console.log(`Sheets 마이그레이션 시작: ${spreadsheetId.slice(0, 6)}...`);
console.log(`Firestore 대상: ${process.env.FIRESTORE_EMULATOR_HOST || '운영 Firestore'}`);

admin.initializeApp();
const db = admin.firestore();

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
google.options({ timeout: 30000 });

const sheetConfig = [
  {
    env: 'SHEET_CONSULTATIONS', name: '상담게시판', collection: 'consultations',
    model: models.consultation, id: row => row.id,
    headers: { ID: 'id', 작성일시: 'createdAt', 분류: 'category', 닉네임: 'nickname', 제목: 'title', 질문: 'question', 답변: 'answer' },
  },
  {
    env: 'SHEET_CATEGORIES', name: '상담 카테고리', collection: 'consultationCategories',
    model: models.consultationCategory,
    headers: { 카테고리: 'category', '공개(Y)/숨김(N)': 'use' },
  },
  {
    env: 'SHEET_NOTICES', name: '공지사항', collection: 'notices', model: models.notice,
    headers: { 카테고리: 'category', 제목: 'title', 내용: 'content', '첨부파일 제목 (비우면 자동)': 'attachmentTitle', '첨부파일 링크': 'attachmentUrl', '날짜 (비우면 자동)': 'publishedAt', '공개(Y)/숨김(N)': 'use' },
  },
  {
    env: 'SHEET_FAQ', name: 'FAQ', collection: 'faqs', model: models.faq,
    headers: { 카테고리: 'category', 질문: 'question', 답변: 'answer', '공개(Y)/숨김(N)': 'use' },
  },
  {
    env: 'SHEET_KCI_LOGS', name: 'KCI 로그', collection: 'kciLogs', model: models.kciLog,
    headers: { 시각: 'time', 종류: 'type', 검색어: 'query', 결과: 'result', '걸린시간(ms)': 'durationMs', '전달된 값 전체': 'payload' },
  },
  {
    env: 'SHEET_API_USAGE', name: 'API 사용량', collection: 'apiUsage', model: models.apiUsage,
    headers: { 일시: 'occurredAt', 모델: 'model', 입력토큰: 'inputTokens', 출력토큰: 'outputTokens', 생각토큰: 'reasoningTokens', 합계토큰: 'totalTokens', '요금(USD)': 'costUsd', '환산(원)': 'costKrw', '소요(ms)': 'durationMs' },
  },
  {
    // Existing vectors are 3072 dimensions and are not usable as Firestore
    // VectorValues. Keep the chunk/source metadata and rebuild embeddings in
    // the new RAG store.
    env: 'SHEET_RAG_VECTOR_INDEX', name: 'RAG_벡터인덱스', collection: 'ragChunks',
    transform: raw => ({
      chunkText: raw['청크텍스트'] || '',
      sourceFile: raw['출처파일'] || '',
    }),
  },
];

function canonicalHeader(header) {
  return String(header || '').replace(/\s+/g, '').trim();
}

function rowToObject(headers, values) {
  return headers.reduce((row, header, index) => {
    row[canonicalHeader(header)] = values[index] ?? '';
    return row;
  }, {});
}

function parseCell(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('[') && trimmed.endsWith(']'))
    || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      // Keep non-JSON text unchanged.
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function prepareFirestoreValues(model) {
  return Object.fromEntries(Object.entries(model).map(([key, value]) => {
    const isVectorField = /vector|embedding|임베딩|벡터/i.test(key);
    if (isVectorField && Array.isArray(value) && value.length > 100) {
      return [key, admin.firestore.FieldValue.vector(value.map(Number))];
    }
    return [key, value];
  }));
}

function mapRow(raw, config) {
  if (config.transform) return config.transform(raw);
  if (config.raw) {
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, parseCell(value)]),
    );
  }
  const mapped = {};
  for (const [header, field] of Object.entries(config.headers)) {
    const value = raw[canonicalHeader(header)];
    if (value !== undefined) mapped[field] = value;
  }
  return config.model(mapped);
}

function stableId(config, model, rowNumber) {
  const explicitId = config.id ? String(config.id(model) || '').trim() : '';
  if (explicitId) return explicitId;
  const digest = crypto.createHash('sha1').update(JSON.stringify(model)).digest('hex').slice(0, 20);
  return `imported-${rowNumber}-${digest}`;
}

async function readSheet(config) {
  const sheetName = process.env[config.env] || config.name;
  console.log(`시트 읽는 중: ${sheetName}`);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = (metadata.data.sheets || [])
    .map(sheet => sheet.properties && sheet.properties.title)
    .filter(Boolean);
  const normalizedName = sheetName.replace(/\s+/g, '').trim();
  const actualName = titles.find(title => title === sheetName)
    || titles.find(title => title.replace(/\s+/g, '').trim() === normalizedName);
  if (!actualName) {
    throw new Error(`탭 "${sheetName}"을 찾을 수 없습니다. 사용 가능한 탭: ${titles.join(', ')}`);
  }
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${actualName.replace(/'/g, "''")}'!A1:Z`,
  });
  const values = response.data.values || [];
  console.log(`시트 읽기 완료: ${actualName} (${Math.max(values.length - 1, 0)}건)`);
  if (!values.length) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(value => String(value || '').trim()))
    .map((row, index) => ({ raw: rowToObject(headers, row), rowNumber: index + 2 }));
}

async function writeCollection(config, entries) {
  let batch = db.batch();
  let writes = 0;
  let batchBytes = 0;
  const maxBatchWrites = config.raw ? 1 : 100;
  const maxBatchBytes = config.raw ? 256 * 1024 : 5 * 1024 * 1024;
  const maxDocumentBytes = 900 * 1024;
  for (const { raw, rowNumber } of entries) {
    const model = mapRow(raw, config);
    const id = stableId(config, model, rowNumber);
    const data = {
      ...(config.raw ? prepareFirestoreValues(model) : model),
      source: 'google-sheets-migration',
      sourceSheet: process.env[config.env] || config.name,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const documentBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
    if (documentBytes > maxDocumentBytes) {
      throw new Error(`${config.collection}/${id} 문서가 너무 큽니다 (${documentBytes} bytes). Firestore 문서 크기 제한을 초과할 수 있습니다.`);
    }
    if (writes > 0 && (writes >= maxBatchWrites || batchBytes + documentBytes > maxBatchBytes)) {
      await commitBatch(batch, config.collection);
      batch = db.batch();
      writes = 0;
      batchBytes = 0;
    }
    batch.set(db.collection(config.collection).doc(id), data, {merge: true});
    writes += 1;
    batchBytes += documentBytes;
  }
  if (writes > 0) await commitBatch(batch, config.collection);
  return writes;
}

async function commitBatch(batch, collection) {
  console.log(`Firestore 쓰기 중: ${collection}`);
  await Promise.race([
    batch.commit(),
    new Promise((resolve, reject) => setTimeout(
      () => reject(new Error(
        'Firestore 쓰기 시간 초과입니다. FIRESTORE_EMULATOR_HOST와 Emulator 상태를 확인하세요.',
      )),
      15000,
    )),
  ]);
  console.log(`Firestore 쓰기 완료: ${collection}`);
}

async function main() {
  for (const config of sheetConfig) {
    let entries;
    try {
      entries = await readSheet(config);
    } catch (error) {
      throw new Error(`${config.name} 시트 읽기 권한 오류: ${error.message}`);
    }
    try {
      const count = await writeCollection(config, entries);
      console.log(`${config.name}: ${count}건 → ${config.collection}`);
    } catch (error) {
      throw new Error(`${config.collection} Firestore 쓰기 권한 오류: ${error.message}`);
    }
  }
  console.log('Sheets → Firestore 마이그레이션 완료');
}

main().catch(error => {
  console.error('마이그레이션 실패:', error.message);
  process.exitCode = 1;
});
