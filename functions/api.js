/* eslint-disable */
const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

setGlobalOptions({region: "asia-northeast3", maxInstances: 10});
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KIPRIS_API_KEY = process.env.KIPRIS_API_KEY;
const KIPRIS_BASE = "https://plus.kipris.or.kr/openapi/rest/";

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function json(res, status, body) {
  cors(res);
  res.status(status).json(body);
}

function text(value) {
  return String(value ?? "").trim();
}

function hidden(value) {
  return ["N", "NO", "FALSE", "0", "숨김", "비공개", "비노출"]
    .includes(text(value).toUpperCase());
}

function asDate(value) {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function publicDoc(doc) {
  const data = doc.data();
  return {id: doc.id, ...data};
}

async function collectionItems(name) {
  const snapshot = await db.collection(name).get();
  return snapshot.docs.map(publicDoc);
}

async function listConsultations() {
  const items = (await collectionItems("consultations"))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((item) => ({
      id: item.id,
      date: asDate(item.createdAt),
      category: text(item.category),
      nickname: text(item.nickname) || "익명",
      title: text(item.title) || text(item.question).slice(0, 30),
      question: text(item.question),
      answer: text(item.answer),
      answered: Boolean(item.answered ?? text(item.answer)),
    }));
  return {items};
}

async function listFaq() {
  const items = (await collectionItems("faqs"))
    .filter((item) => text(item.question) && text(item.answer) && !hidden(item.use))
    .map((item) => ({
      cat: text(item.category) || "기타",
      q: text(item.question),
      a: text(item.answer),
      use: text(item.use),
    }));
  return {items};
}

async function listCategories() {
  const items = (await collectionItems("consultationCategories"))
    .filter((item) => text(item.category) && !hidden(item.use))
    .map((item) => ({category: text(item.category), use: text(item.use)}));
  return {items};
}

async function listNotices() {
  const items = (await collectionItems("notices"))
    .filter((item) => !hidden(item.use))
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))
    .map((item) => ({
      cat: text(item.category) || "공지",
      title: text(item.title),
      content: text(item.content),
      attachTitle: text(item.attachmentTitle),
      attachLink: text(item.attachmentUrl),
      date: asDate(item.publishedAt),
      use: text(item.use),
    }));
  return {items};
}

async function submitQuestion(data) {
  const title = text(data.title);
  const question = text(data.question);
  if (!title) throw new Error("제목이 없습니다.");
  if (!question) throw new Error("질문 내용이 없습니다.");
  const ref = await db.collection("consultations").add({
    category: text(data.category) || "기타",
    nickname: text(data.nickname) || "익명",
    title,
    question,
    answer: "",
    answered: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "cloud-function-api",
  });
  return {success: true, id: ref.id};
}

const SYSTEM_PROMPT = [
  "당신은 국가연구개발 성과관리 전문 AI 상담사입니다.",
  "제공된 자료에서 확인되는 내용만으로 답하고, 모르면 추측하지 마세요.",
  "법 조항 번호와 구체적 수치는 자료에 있을 때만 언급하세요.",
  "친절하고 명확한 한국어로 답하며, 답변 끝에 정확한 내용은 성과조사콜센터(042-869-6677)로 확인하시기 바랍니다.를 붙이세요.",
].join("\n");

async function chat(data) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  const history = Array.isArray(data.history) ? data.history : [];
  const contents = history
    .filter((item) => item && ["user", "model"].includes(item.role))
    .map((item) => ({
      role: item.role,
      parts: [{text: text(item.parts?.[0]?.text)}],
    }))
    .filter((item) => item.parts[0].text)
    .slice(-10);
  if (!contents.length) throw new Error("메시지를 입력하세요.");

  const faq = await listFaq();
  const context = faq.items.map((item) => `[${item.cat}] ${item.q} → ${item.a}`).join("\n");
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/"
    + "gemini-3.6-flash:generateContent?key=" + encodeURIComponent(GEMINI_API_KEY);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({systemInstruction: {parts: [{text: SYSTEM_PROMPT + "\n\n자료:\n" + context}]}, contents}),
  });
  if (!response.ok) throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const answer = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!answer) throw new Error("AI 응답이 비어 있습니다.");
  return {answer};
}

function xmlValue(tags, xml) {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, "is"));
    if (match) return match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  }
  return "";
}

function parsePatentXml(xml) {
  const blocks = xml.match(/<PatentUtilityInfo>[\s\S]*?<\/PatentUtilityInfo>/gi)
    || xml.match(/<item>[\s\S]*?<\/item>/gi) || [xml];
  return blocks.map((block) => ({
    applicationNumber: xmlValue(["ApplicationNumber", "applicationNumber", "applicationNo"], block),
    registrationNumber: xmlValue(["RegistrationNumber", "registrationNumber", "registerNumber"], block),
    title: xmlValue(["InventionName", "inventionTitle"], block),
    applicant: xmlValue(["Applicant", "applicantName"], block),
    inventor: xmlValue(["inventorName", "Inventor"], block),
    applicationDate: xmlValue(["ApplicationDate", "applicationDate"], block),
    registrationDate: xmlValue(["RegistrationDate", "registrationDate", "registerDate"], block),
    openDate: xmlValue(["OpeningDate", "openDate"], block),
    openNumber: xmlValue(["OpeningNumber", "openNumber", "publicationNumber"], block),
    status: xmlValue(["RegistrationStatus", "registerStatus"], block),
  })).filter((item) => item.title || item.applicationNumber);
}

async function patent(data) {
  if (!KIPRIS_API_KEY) throw new Error("KIPRIS_API_KEY 환경변수가 설정되지 않았습니다.");
  const query = text(data.query);
  if (!query) throw new Error("검색어를 입력하세요.");
  const type = text(data.type) || "application";
  const country = text(data.country) || "KR";
  const number = query.replace(/[^0-9]/g, "");
  let url;
  if (type === "word") {
    // KIPRIS free search uses `word` for title/keyword text search.
    // Do not derive or send an application/registration number here.
    url = KIPRIS_BASE + "patUtiModInfoSearchSevice/freeSearchInfo"
      + `?word=${encodeURIComponent(query)}&patent=true&utility=true`
      + "&docsCount=50&docsStart=1";
  } else if (country === "KR") {
    const endpoint = type === "application"
      ? "applicationNumberSearchInfo" : "registrationNumberSearchInfo";
    const key = type === "application" ? "applicationNumber" : "registerNumber";
    url = KIPRIS_BASE + "patUtiModInfoSearchSevice/" + endpoint
      + `?${key}=${number}`;
  } else {
    url = KIPRIS_BASE + "ForeignPatentAdvencedSearchService/applicationNumber"
      + `Search?applicationNumber=${encodeURIComponent(query)}&collectionValues=${country}`;
  }
  url += `&accessKey=${encodeURIComponent(KIPRIS_API_KEY)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`KIPRIS API ${response.status}`);
  return {items: parsePatentXml(await response.text())};
}

async function route(req) {
  let data = req.method === "POST" ? (req.body || {}) : req.query;
  // The legacy frontend intentionally sends text/plain to avoid Apps Script
  // CORS behavior. Express leaves that body as a string, so parse it here.
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (error) {
      throw Object.assign(new Error("JSON 요청 본문을 읽을 수 없습니다."), {status: 400});
    }
  }
  switch (text(data.action)) {
    case "list": return listConsultations();
    case "faq": return listFaq();
    case "notice": return listNotices();
    case "boardCategory": return listCategories();
    case "submit": return submitQuestion(data);
    case "chat": return chat(data);
    case "patent": return patent(data);
    case "inventors": return {map: {}};
    default: throw Object.assign(new Error("알 수 없는 요청"), {status: 400});
  }
}

exports.api = onRequest(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    return json(res, 200, await route(req));
  } catch (error) {
    logger.error("API request failed", error);
    return json(res, error.status || 500, {error: error.message || "서버 오류"});
  }
});
