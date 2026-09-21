'use strict';

/* ============================================================
 * CONFIG — Google Sheets 연동 준비가 끝나면 아래 값을 채우세요.
 * (전부 비어있으면 자동으로 MOCK_DATA로 동작합니다)
 *
 * csv.* : 각 시트를 "파일 > 공유 > 웹에 게시"로 CSV 게시한 URL
 *   - managers : 이름 | 급여형태 | 입사일 | 누적횟수 | 최근근무일 | 제외요일
 *   - forklift : 이름 | 급여형태 | 입사일 | 누적횟수 | 최근근무일 | 제외요일
 *   - field    : 이름 | 소속 | FB | 입사일 | 누적횟수 | 최근근무일 | 제외요일 | 고정근무 | 부서
 *              (FB, 고정근무 컬럼: TRUE/FALSE. 고정근무=TRUE인 사람은 매주 토·일 자동 근무
 *               처리되고 로테이션 카운트에서 빠진다 — 차은미 같은 스케줄근무자용. 없으면 전부 FALSE)
 *              (부서 컬럼: 운영1 / 운영2. 현장 인원을 부서별로 나눠 배정한다. 관리자·지게차는
 *               부서 구분 없이 전원이 대상이라 부서 컬럼이 있어도 무시한다.
 *               모드 버튼: 풀필먼트2팀 = 두 부서 합산, 운영2 = 운영2 인원만)
 *   ※ 제외요일 : "일요일" / "토요일" 처럼 그 사람을 절대 배정하면 안 되는 요일. 없으면 빈칸.
 *              여러 개면 "토요일,일요일"처럼 쉼표로 구분.
 *   - tieBreakHistory : 그룹 | 이름   (그룹 칸이 "1회제한 2026-11 현장"이면 그 달 1회만 배정할 사람)
 *   - holidays : 날짜 | 설명
 * fieldConfigCsv (선택) : 현장 토/일 필요인원을 시트에서 관리하고 싶을 때만 채우기
 *   - 요일 | 부서 | 필요인원   (요일: "토"/"일". 부서 열이 없는 옛 형식도 읽는다.
 *     예전에 쓰던 "최소FB" 열이 남아 있어도 무시한다)
 *   - 부서 칸에 "지게차" 또는 "관리자"를 적으면 그 그룹의 요일별 하루 필요인원이 된다.
 *     (예: 토요일 | 지게차 | 2). 적지 않으면 하루 1명이다. 0이면 그 요일엔 배정하지 않는다.
 *   - 비워두면 운영1 토1/일2 + 운영2 토2/일2로 동작합니다.
 * scheduleLogCsv (선택) : ScheduleLog 탭(날짜 | 요일 | 그룹 | 이름)을 CSV로 게시한 URL.
 *   채우면 "최근 3개월 근무 횟수(신규 인원은 근무 가능했던 달 기준 평균)"로 공평하게 배정하고,
 *   비워두면 예전처럼 누적횟수 기준으로 동작한다. 확정 저장을 하면 이 탭에 근무 기록이 쌓인다.
 * appsScriptUrl : Apps Script를 웹앱으로 배포한 .../exec 주소
 * ============================================================ */
const CONFIG = {
  csv: {
    managers: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=505076121&single=true&output=csv',
    forklift: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=1436539870&single=true&output=csv',
    field: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=1795010271&single=true&output=csv',
    tieBreakHistory: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=586751447&single=true&output=csv',
    holidays: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=732531628&single=true&output=csv',
  },
  fieldConfigCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=1178110041&single=true&output=csv',
  scheduleLogCsv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJDCbE2_IAeJws9NdoGOvq4xWP5O1FRqd1dgSTnjg8hGfJzSWPB_uY6GBDO2ERwGtIdcx7ZAeSZWRg/pub?gid=2067900083&single=true&output=csv',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzeXNoXgwrPhQCVXRIEJKGY4ZH2XWZ2U49gxCdB_QScQSITTrpC6g6Efje9zbOaU5y5/exec',
  rules: {
    newHireGraceMonths: 1,
  },
};

function isConfigured() {
  return Object.values(CONFIG.csv).every((u) => u && u.startsWith('http')) &&
    CONFIG.appsScriptUrl.startsWith('http');
}

/**
 * 고정근무자(구 SCHEDULE_WORKER) — 이름을 코드에 박아두지 않고, Field 시트의
 * "고정근무" 컬럼(TRUE/FALSE)으로 관리한다. 사람이 바뀌거나 없어져도 시트만
 * 고치면 되고, 코드 재배포가 필요 없다. 매주 토~수 자동 근무 패턴을 가정하고
 * 로테이션 카운트 대상에서는 제외한다.
 */
function getScheduleWorkers(members) {
  return members.filter((m) => m.scheduleWorker);
}

function getScheduleWorkerNameSet(members) {
  return new Set(getScheduleWorkers(members).map((m) => m.name));
}

/**
 * 현장 부서별 필요인원 기본값 — FieldConfig 시트에 부서 행이 없을 때만 쓰는 안전장치.
 * 고정근무자(차은미 등)는 시트의 부서 칸에 적힌 부서의 인원수에 포함된다.
 * 실제 값은 시트에서 관리한다.
 */
const FIELD_DEPT_DEFAULTS = {
  '운영1': { requiredSat: 1, requiredSun: 2 },
  '운영2': { requiredSat: 2, requiredSun: 2 },
};
const ZERO_FIELD_CFG = { requiredSat: 0, requiredSun: 0 };

function copyFieldDeptDefaults() {
  const out = {};
  Object.entries(FIELD_DEPT_DEFAULTS).forEach(([dept, cfg]) => { out[dept] = { ...cfg }; });
  return out;
}

/** 부서 구분이 없는 옛 방식(전체 한 팀)일 때 쓸 합계 — 부서별 값을 모두 더한다 */
function sumFieldTotals(byDept) {
  const vals = Object.values(byDept);
  return {
    requiredSat: vals.reduce((a, v) => a + v.requiredSat, 0),
    requiredSun: vals.reduce((a, v) => a + v.requiredSun, 0),
  };
}

/**
 * 관리자·지게차의 요일별 하루 필요인원. FieldConfig 시트에 행이 없으면 하루 1명.
 * (현장은 부서별로 따로 관리하니 getFieldPools를 쓴다)
 */
const DEFAULT_GROUP_REQUIRED = { sat: 1, sun: 1 };
const CONFIG_GROUP_BY_LABEL = { '관리자': 'managers', '지게차': 'forklift' };

function getGroupRequired(data, group, dow) {
  const r = (data[group] && data[group].required) || DEFAULT_GROUP_REQUIRED;
  return dow === 'sat' ? r.sat : r.sun;
}

/** 표에 필요한 칸(열) 수 = 토·일 중 더 많이 필요한 쪽 */
function getGroupCols(data, group) {
  return Math.max(getGroupRequired(data, group, 'sat'), getGroupRequired(data, group, 'sun'));
}

/** 관리자/지게차 칸의 머리글 — 1칸이면 그룹 이름 그대로, 여러 칸이면 번호를 붙인다 */
function groupHeaderLabels(label, cols) {
  if (cols <= 1) return cols === 1 ? [label] : [];
  return Array.from({ length: cols }, (_, i) => `${label}${i + 1}`);
}

/** "운영 2", "운영2부서" 같은 표기 흔들림을 "운영2"로 통일 */
function normalizeDept(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '').replace(/부서$/, '');
}

/* ============================================================
 * MOCK DATA — Google Sheets 연동 전 화면/알고리즘 검증용 초기 데이터.
 * 2026년 9월 실적 기준 실제 명단입니다 (급여형태/소속 라벨은 Google Sheets
 * 쪽 컬럼으로 분리 관리하므로 여기 이름에는 포함하지 않았습니다).
 * Google Sheets 연동이 설정되면 이 값 대신 시트 데이터를 사용합니다.
 * ============================================================ */
const MOCK_DATA = {
  managers: {
    label: '관리자',
    required: { sat: 1, sun: 1 },
    members: [
      { name: '이정명', count: 1, lastWorked: '2026-09-05' },
      { name: '김영민', count: 2, lastWorked: '2026-09-20' },
      { name: '김수현', count: 2, lastWorked: '2026-09-27' },
      { name: '차혜림', count: 1, lastWorked: '2026-09-13' },
      { name: '홍상민', count: 1, lastWorked: '2026-09-19' },
    ],
  },
  forklift: {
    label: '지게차',
    required: { sat: 1, sun: 1 },
    members: [
      { name: '박인철', count: 1, lastWorked: '2026-09-05' },
      { name: '유기상', count: 2, lastWorked: '2026-09-27' },
      { name: '어승환', count: 2, lastWorked: '2026-09-19' },
      { name: '최진혁', count: 2, lastWorked: '2026-09-20' },
      {
        name: '이지훈',
        count: 0,
        lastWorked: '',
        joinDate: '2026-09-01',
        excludedWeekdays: new Set(['일요일']),
      },
    ],
  },
  field: {
    label: '현장',
    // 목업 명단에는 부서 정보가 없어서 부서 구분 없이 한 팀으로 동작한다 (옛 방식)
    legacyTotals: { requiredSat: 4, requiredSun: 2 },
    byDept: FIELD_DEPT_DEFAULTS,
    members: [
      { name: '진영미', fb: true, count: 1, lastWorked: '2026-09-05' },
      { name: '박준호', fb: false, count: 1, lastWorked: '2026-09-05' },
      { name: '김예빈', fb: true, count: 2, lastWorked: '2026-09-20' },
      { name: '박선민', fb: false, count: 2, lastWorked: '2026-09-27' },
      { name: '임범택', fb: true, count: 1, lastWorked: '2026-09-06' },
      { name: '홍귀순', fb: true, count: 2, lastWorked: '2026-09-27' },
      { name: '전경민', fb: false, count: 1, lastWorked: '2026-09-12' },
      { name: '이미혜', fb: false, count: 2, lastWorked: '2026-09-19' },
      { name: '김미진', fb: false, count: 2, lastWorked: '2026-09-27' },
      { name: '강혜원', fb: true, count: 2, lastWorked: '2026-09-19' },
      { name: '심혜영', fb: true, count: 1, lastWorked: '2026-09-13' },
      { name: '진나윤', fb: true, count: 1, lastWorked: '2026-09-13' },
      { name: '김규희', fb: false, count: 1, lastWorked: '2026-09-19' },
      { name: '김진주', fb: false, count: 1, lastWorked: '2026-09-19' },
      { name: '조영주', fb: false, count: 1, lastWorked: '2026-09-20' },
      { name: '정용운', fb: false, count: 1, lastWorked: '2026-09-20' },
      { name: '채희정', fb: true, count: 1, lastWorked: '2026-09-27' },
      { name: '윤민경', fb: false, count: 1, lastWorked: '2026-09-27' },
      { name: '이소연', fb: false, count: 1, lastWorked: '2026-09-27' },
      { name: '차은미(고은)', fb: false, count: 0, lastWorked: '', scheduleWorker: true },
    ],
  },
  tieBreakHistory: { managers: [], forklift: [], field: [], monthLimits: {} },
  holidays: new Map([
    ['2026-01-01', '신정'],
    ['2026-02-16', '설날연휴'], ['2026-02-17', '설날연휴'], ['2026-02-18', '설날연휴'],
    ['2026-03-01', '삼일절'], ['2026-03-02', '대체공휴일'],
    ['2026-05-05', '어린이날'], ['2026-05-24', '부처님오신날'], ['2026-05-25', '대체공휴일'],
    ['2026-06-06', '현충일'],
    ['2026-07-17', '공휴일'],
    ['2026-08-15', '광복절'], ['2026-08-17', '대체공휴일'],
    ['2026-09-24', '추석연휴'], ['2026-09-25', '추석연휴'], ['2026-09-26', '추석연휴'],
    ['2026-10-03', '개천절'], ['2026-10-05', '대체공휴일'], ['2026-10-09', '한글날'],
    ['2026-12-25', '성탄절'],
  ]),
};

function cloneMockData() {
  return {
    managers: { ...MOCK_DATA.managers, members: MOCK_DATA.managers.members.map((m) => ({ ...m })) },
    forklift: { ...MOCK_DATA.forklift, members: MOCK_DATA.forklift.members.map((m) => ({ ...m })) },
    field: { ...MOCK_DATA.field, members: MOCK_DATA.field.members.map((m) => ({ ...m })) },
    tieBreakHistory: {
      managers: [...MOCK_DATA.tieBreakHistory.managers],
      forklift: [...MOCK_DATA.tieBreakHistory.forklift],
      field: [...MOCK_DATA.tieBreakHistory.field],
      monthLimits: {},
    },
    holidays: new Map(MOCK_DATA.holidays),
    shiftLog: null,
    warnings: [],
  };
}

/* ============================================================
 * 날짜 유틸 (전부 로컬 타임존 기준, UTC 파싱으로 인한 하루 밀림 방지)
 * ============================================================ */
function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function previousDayIso(date) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

function addMonths(date, n) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * ExcelJS는 JS Date를 UTC 기준으로 시리얼 변환한다. KST(UTC+9)처럼 UTC 오프셋이
 * 양수인 로컬 타임존에서 parseISODate(로컬 자정)를 그대로 넘기면 하루 전 날짜
 * (+15시 단수)로 밀려서 저장된다. 엑셀 export 전용으로 UTC 자정 기준 Date를 만든다.
 */
function toExcelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatKoreanDate(iso) {
  const [, m, d] = iso.split('-');
  return `${m}월 ${d}일`;
}

function getWeekendDatesInMonth(year, month) {
  const result = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 6) result.push({ date, dow: 'sat' });
    else if (dow === 0) result.push({ date, dow: 'sun' });
  }
  return result;
}

// 시트를 읽는 동안 발견한 문제(읽을 수 없는 날짜 등)를 모아서 화면 경고로 보여준다.
let PARSE_WARNINGS = [];

/**
 * 시트에 사람이 손으로 친 날짜를 YYYY-MM-DD로 통일한다.
 * YYYY-MM-DD, YYYY.M.D, YYYY/M/D, YYYYMMDD, YYMMDD(261011 → 2026-10-11)를 읽고,
 * 그 외 형식은 Date 파싱을 시도하되 2000~2100년을 벗어나면 잘못된 값으로 본다
 * (예전엔 "261011"을 26만년으로 읽어서 그 사람이 영원히 배정 불가가 됐다).
 */
function normalizeDateString(v, label) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let ymd = null;
  let match = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/);
  if (match) ymd = [match[1], match[2], match[3]];
  if (!ymd && (match = s.match(/^(\d{4})(\d{2})(\d{2})$/))) ymd = [match[1], match[2], match[3]];
  if (!ymd && (match = s.match(/^(\d{2})(\d{2})(\d{2})$/))) ymd = [`20${match[1]}`, match[2], match[3]];
  if (ymd) {
    const [y, m, d] = ymd.map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
    return toISODate(parsed);
  }
  if (label) PARSE_WARNINGS.push(`${label}: "${s}" 날짜를 읽을 수 없어 무시합니다 (YYYY-MM-DD 형식으로 입력해주세요)`);
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ============================================================
 * 데이터 로딩 (Google Sheets CSV 게시 → JSON, 미설정 시 MOCK_DATA)
 * ============================================================ */
/** 헤더 없이 칸 위치로 읽는 CSV (ScheduleLog: 날짜 | 요일 | 그룹 | 이름) */
function fetchCsvRows(url, bust) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${bust}`;
    Papa.parse(fullUrl, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}

/** ScheduleLog의 그룹 칸("관리자" / "지게차" / "현장" / "현장·운영2")을 그룹 키로 */
function logGroupKey(label) {
  const s = String(label || '').trim();
  if (s.startsWith('관리자')) return 'managers';
  if (s.startsWith('지게차')) return 'forklift';
  if (s.startsWith('현장')) return 'field';
  return null;
}

/**
 * 확정 저장으로 쌓인 근무 기록. URL이 없으면 null(= 누적횟수 기준으로 동작), 읽기에 실패하면
 * null과 에러 메시지를 돌려준다.
 */
async function loadShiftLog() {
  const url = CONFIG.scheduleLogCsv;
  if (!url || !url.startsWith('http')) return { log: null, error: '' };
  try {
    const rows = await fetchCsvRows(url, `cachebust=${Date.now()}`);
    const log = [];
    rows.forEach((r) => {
      const date = normalizeDateString(r[0]); // 머리글 줄은 날짜가 아니라서 자연스럽게 걸러진다
      const group = logGroupKey(r[2]);
      const name = String(r[3] || '').trim();
      if (date && group && name) log.push({ date, group, name });
    });
    return { log, error: '' };
  } catch (err) {
    return { log: null, error: String((err && err.message) || err) };
  }
}

function fetchCsv(url, bust) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${bust}`;
    Papa.parse(fullUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}

function parseExcludedWeekdays(v) {
  const s = (v || '').trim();
  if (!s) return new Set();
  return new Set(s.split(/[,·\/]/).map((x) => x.trim()).filter(Boolean));
}

function parseRosterRow(row) {
  const name = (row['이름'] || '').trim();
  return {
    name,
    count: Number(row['누적횟수'] || 0),
    lastWorked: normalizeDateString(row['최근근무일'], name && `${name} 최근근무일`),
    joinDate: normalizeDateString(row['입사일'], name && `${name} 입사일`) || null,
    excludedWeekdays: parseExcludedWeekdays(row['제외요일']),
    dept: normalizeDept(row['부서']),
  };
}

function parseFieldRow(row) {
  const base = parseRosterRow(row);
  const fbRaw = String(row['FB'] || '').trim().toUpperCase();
  const swRaw = String(row['고정근무'] || '').trim().toUpperCase();
  return {
    ...base,
    fb: fbRaw === 'TRUE' || fbRaw === '1' || fbRaw === 'Y',
    scheduleWorker: swRaw === 'TRUE' || swRaw === '1' || swRaw === 'Y',
  };
}

function mapGroupLabelToKey(v) {
  const s = (v || '').trim();
  if (s === 'managers' || s === '관리자') return 'managers';
  if (s === 'forklift' || s === '지게차') return 'forklift';
  if (s === 'field' || s === '현장') return 'field';
  return null;
}

const LIMIT_ROW_PREFIX = '1회제한';
const LIMIT_GROUP_LABELS = { managers: '관리자', forklift: '지게차', field: '현장' };
const LIMIT_GROUPS = ['managers', 'forklift', 'field'];

function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function nextYmKey(year, month) {
  return month === 12 ? ymKey(year + 1, 1) : ymKey(year, month + 1);
}

/**
 * TieBreakHistory 시트의 그룹 칸에 "1회제한 2026-11 현장" 처럼 적힌 행 = 그 달에 1회만 배정할 사람.
 * (지난달에 3회 근무한 사람을 저장할 때 자동으로 적히고, 직접 적어도 된다)
 */
function parseLimitGroupLabel(label) {
  const m = String(label || '').trim().match(/^1회제한\s+(\d{4})-(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const group = mapGroupLabelToKey(m[3]);
  return group ? { ym: ymKey(Number(m[1]), Number(m[2])), group } : null;
}

function addMonthLimit(monthLimits, ym, group, name) {
  if (!monthLimits[ym]) monthLimits[ym] = { managers: [], forklift: [], field: [] };
  if (!monthLimits[ym][group].includes(name)) monthLimits[ym][group].push(name);
}

function parseTieBreakRows(rows) {
  const result = { managers: [], forklift: [], field: [], monthLimits: {} };
  rows.forEach((r) => {
    const name = (r['이름'] || '').trim();
    if (!name) return;
    const limit = parseLimitGroupLabel(r['그룹']);
    if (limit) {
      addMonthLimit(result.monthLimits, limit.ym, limit.group, name);
      return;
    }
    if (String(r['그룹'] || '').trim().startsWith(LIMIT_ROW_PREFIX)) {
      PARSE_WARNINGS.push(`TieBreakHistory의 "${String(r['그룹']).trim()}" 행을 읽을 수 없어 무시합니다 (예: ${LIMIT_ROW_PREFIX} 2026-11 지게차 — 그룹은 관리자/지게차/현장).`);
      return;
    }
    const group = mapGroupLabelToKey(r['그룹']);
    if (group) result[group].push(name);
  });
  return result;
}

/** 빈 칸은 "값 없음"으로 본다 (Number('')는 0이라서 그대로 쓰면 빈 칸이 0명이 된다) */
function parseConfigNumber(v) {
  const s = String(v == null ? '' : v).trim();
  return s === '' ? NaN : Number(s);
}

/**
 * FieldConfig 시트: 요일 | 부서 | 필요인원
 *  - 부서 칸이 있는 행 → 그 부서의 요일별 필요인원 (byDept)
 *  - 부서 칸이 없는 옛 형식 행 → 부서 구분 없이 전체 한 팀일 때 쓰는 합계 (legacyTotals)
 *  - 시트에 없는 부서/값은 FIELD_DEPT_DEFAULTS로 채운다
 */
async function loadFieldConfig() {
  const fallback = () => ({
    byDept: copyFieldDeptDefaults(),
    legacyTotals: null,
    hasDeptRows: false,
    groups: { managers: { ...DEFAULT_GROUP_REQUIRED }, forklift: { ...DEFAULT_GROUP_REQUIRED } },
  });
  const url = CONFIG.fieldConfigCsv;
  if (!url || !url.startsWith('http')) return fallback();
  try {
    const rows = await fetchCsv(url, `cachebust=${Date.now()}`);
    const result = fallback();
    const legacy = sumFieldTotals(result.byDept);
    let sawLegacy = false;
    rows.forEach((r) => {
      const day = (r['요일'] || '').trim();
      const key = day.startsWith('토') ? 'Sat' : day.startsWith('일') ? 'Sun' : null;
      if (!key) return;
      const required = parseConfigNumber(r['필요인원']);
      const dept = normalizeDept(r['부서']);
      const groupKey = CONFIG_GROUP_BY_LABEL[dept];
      if (groupKey) {
        // "지게차"/"관리자" 행은 부서가 아니라 그 그룹의 하루 필요인원이다
        if (!Number.isNaN(required) && required >= 0) result.groups[groupKey][key === 'Sat' ? 'sat' : 'sun'] = Math.round(required);
      } else if (dept) {
        result.hasDeptRows = true;
        if (!result.byDept[dept]) result.byDept[dept] = { ...ZERO_FIELD_CFG };
        if (!Number.isNaN(required)) result.byDept[dept][`required${key}`] = required;
      } else {
        sawLegacy = true;
        if (!Number.isNaN(required)) legacy[`required${key}`] = required;
      }
    });
    result.legacyTotals = sawLegacy ? legacy : null;
    return result;
  } catch (err) {
    console.warn('FieldConfig 로드 실패, 기본값으로 동작합니다:', err);
    return fallback();
  }
}

/** 시트 상태를 보고 사용자에게 알려야 할 문제를 문장으로 만든다 (화면 경고 배너용) */
function buildDataWarnings(data, info) {
  const warnings = [...PARSE_WARNINGS];
  Object.entries((data.tieBreakHistory && data.tieBreakHistory.monthLimits) || {}).forEach(([ym, groups]) => {
    LIMIT_GROUPS.forEach((g) => {
      const known = new Set(data[g].members.map((m) => m.name));
      const unknown = (groups[g] || []).filter((n) => !known.has(n));
      if (unknown.length) {
        warnings.push(`TieBreakHistory의 ${ym} ${LIMIT_GROUP_LABELS[g]} 1회제한 명단에 시트에 없는 이름이 있어 무시합니다: ${unknown.join(', ')}`);
      }
    });
  });
  const members = data.field.members;
  if (!info.fieldHasDeptColumn) {
    warnings.push('Field 시트에 "부서" 컬럼이 없어 현장 인원 전체를 한 팀으로 보고 배정합니다 (운영1/운영2 구분 없음).');
  } else if (!members.some((m) => m.dept)) {
    warnings.push('Field 시트의 "부서" 칸이 모두 비어 있어 현장 인원 전체를 한 팀으로 보고 배정합니다.');
  } else {
    const blank = members.filter((m) => !m.dept).map((m) => m.name);
    if (blank.length) {
      warnings.push(`부서가 비어 있어 배정에서 제외된 현장 인원 ${blank.length}명: ${blank.join(', ')} — Field 시트의 부서 칸을 채워주세요.`);
    }
    if (!info.configHasDeptRows) {
      const defaults = Object.entries(FIELD_DEPT_DEFAULTS)
        .map(([dept, c]) => `${dept} 토${c.requiredSat}·일${c.requiredSun}`).join(' / ');
      warnings.push(`FieldConfig 시트에 "부서" 열이 없어 기본값(${defaults})으로 배정합니다.`);
    }
  }
  return warnings;
}

async function loadData() {
  const banner = document.getElementById('configBanner');
  if (!isConfigured()) {
    banner.hidden = false;
    return cloneMockData();
  }
  banner.hidden = true;

  const bust = `cachebust=${Date.now()}`;
  PARSE_WARNINGS = [];
  const [managersRows, forkliftRows, fieldRows, tieRows, holidayRows, fieldConfig, shiftLogResult] = await Promise.all([
    fetchCsv(CONFIG.csv.managers, bust),
    fetchCsv(CONFIG.csv.forklift, bust),
    fetchCsv(CONFIG.csv.field, bust),
    fetchCsv(CONFIG.csv.tieBreakHistory, bust),
    fetchCsv(CONFIG.csv.holidays, bust),
    loadFieldConfig(),
    loadShiftLog(),
  ]);

  const data = {
    managers: { label: '관리자', required: fieldConfig.groups.managers, members: managersRows.map((r) => parseRosterRow(r)).filter((m) => m.name) },
    forklift: { label: '지게차', required: fieldConfig.groups.forklift, members: forkliftRows.map((r) => parseRosterRow(r)).filter((m) => m.name) },
    field: {
      label: '현장',
      byDept: fieldConfig.byDept,
      legacyTotals: fieldConfig.legacyTotals,
      members: fieldRows.map((r) => parseFieldRow(r)).filter((m) => m.name),
    },
    tieBreakHistory: parseTieBreakRows(tieRows),
    holidays: new Map(
      holidayRows
        .map((r) => [normalizeDateString(r['날짜'], '공휴일 목록'), (r['설명'] || '공휴일').trim()])
        .filter(([iso]) => iso)
    ),
  };
  data.shiftLog = shiftLogResult.log;
  data.warnings = buildDataWarnings(data, {
    fieldHasDeptColumn: fieldRows.length > 0 && '부서' in fieldRows[0],
    configHasDeptRows: fieldConfig.hasDeptRows,
  });
  if (shiftLogResult.error) {
    data.warnings.push(`ScheduleLog를 읽지 못해 이번에는 누적횟수 기준으로 배정합니다 (${shiftLogResult.error}). 시트 게시 상태와 scheduleLogCsv 주소를 확인해주세요.`);
  }
  return data;
}

/* ============================================================
 * 배정 알고리즘
 *
 * 우선순위: 근무 횟수 오름차순 (요일 교대에 어긋나면 횟수를 +2로 셈. 횟수는 ScheduleLog가 연결돼 있으면
 *           최근 3개월 기준, 아니면 누적횟수) →
 *           교대에 맞는 사람 → 최근근무일 오름차순(오래전 우선) →
 *           지난 동률에서 밀린 이력(owed) 우선 → 이름순(최종 결정론적 fallback)
 *
 * 공평성이 최우선이다. 요일 교대는 "누적횟수가 2회 이내로 비슷할 때" 순서를 정하는
 * 데만 쓰이고, FB 여부 같은 다른 조건은 순위에 영향을 주지 않는다.
 * ============================================================ */
function isEligible(member, date) {
  const dow = date.getDay();
  const dowLabel = dow === 6 ? '토요일' : dow === 0 ? '일요일' : null;
  if (dowLabel && member.excludedWeekdays && member.excludedWeekdays.has(dowLabel)) return false;
  if (member.joinDate) {
    const graceDate = addMonths(parseISODate(member.joinDate), CONFIG.rules.newHireGraceMonths);
    if (date < graceDate) return false;
  }
  return true;
}

/* ------------------------------------------------------------
 * 최근 3개월 공평성 — 누적횟수 대신 "직전 3개월 + 이번 달 진행분"의 근무 횟수로 순위를 매긴다.
 *  - 기록(ScheduleLog)이 있는 달만 센다. 기록이 아직 3개월치 안 쌓였으면 있는 달만으로 시작한다.
 *  - 신규 입사자는 근무 가능했던 달만 세고, 개월 수가 다른 사람과 비교할 수 있게
 *    (횟수 ÷ 근무 가능 개월 수 × 기준 개월 수)로 환산한다 → 따라잡으려고 더 서는 일이 없다.
 * ------------------------------------------------------------ */
function shiftYm(year, month, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return ymKey(Math.floor(idx / 12), (idx % 12) + 1);
}

/** 입사 유예(기본 1개월)가 끝나 처음 배정 대상이 되는 달 ("YYYY-MM"), 입사일이 없으면 null */
function firstEligibleYm(member) {
  if (!member.joinDate) return null;
  const grace = addMonths(parseISODate(member.joinDate), CONFIG.rules.newHireGraceMonths);
  return ymKey(grace.getFullYear(), grace.getMonth() + 1);
}

function buildHistoryIndex(shiftLog) {
  const counts = { managers: new Map(), forklift: new Map(), field: new Map() };
  const months = { managers: new Set(), forklift: new Set(), field: new Set() };
  (shiftLog || []).forEach(({ date, group, name }) => {
    const ym = date.slice(0, 7);
    months[group].add(ym);
    let byMonth = counts[group].get(name);
    if (!byMonth) counts[group].set(name, (byMonth = new Map()));
    byMonth.set(ym, (byMonth.get(ym) || 0) + 1);
  });
  return { counts, months };
}

/** 기록이 있는 직전 3개월(이번 달 제외) */
function priorLoggedMonths(history, group, year, month) {
  return [3, 2, 1].map((k) => shiftYm(year, month, -k)).filter((ym) => history.months[group].has(ym));
}

/** 그룹 인원들에게 "최근 3개월" 순위 정보(win)를 붙인다 */
function attachFairnessWindow(members, group, history, year, month) {
  const prior = priorLoggedMonths(history, group, year, month);
  const cur = ymKey(year, month);
  members.forEach((m) => {
    const first = firstEligibleYm(m);
    const eligible = (ym) => !first || ym >= first;
    const byMonth = history.counts[group].get(m.name);
    let total = 0;
    let months = 0;
    prior.forEach((ym) => {
      if (!eligible(ym)) return;
      months += 1;
      total += (byMonth && byMonth.get(ym)) || 0;
    });
    if (eligible(cur)) months += 1;
    m.win = { total, months: Math.max(1, months), base: prior.length + 1 };
  });
}

/** 순위 매길 때 쓰는 "횟수" — 최근 3개월 기준이 켜져 있으면 환산 횟수, 아니면 누적횟수 */
function fairCount(m) {
  if (!m.win) return m.count;
  return Math.round(((m.win.total * m.win.base) / m.win.months) * 1e6) / 1e6;
}

function lastShiftDow(member) {
  if (!member.lastWorked) return null;
  const day = parseISODate(member.lastWorked).getDay();
  return day === 6 ? 'sat' : day === 0 ? 'sun' : null;
}

/**
 * 요일 교대 규칙: 토요일에 일했으면 다음엔 일요일, 일요일에 일했으면 다음엔 토요일.
 * 직전 근무 요일은 시트의 최근근무일 날짜에서 계산한다.
 *   0 = 교대에 맞음, 1 = 직전과 같은 요일이라 어긋남
 *
 * 절대 규칙도, 횟수보다 앞서는 규칙도 아니다. 교대에 어긋난 사람은 누적횟수를
 * ALTERNATION_WEIGHT(=2)회 더 한 것처럼 취급해서 순위를 매긴다. 그래서 교대는
 * 누적횟수가 2회 이내로 비슷한 사람들 사이에서만 순서를 정하고, 어떤 자리 구성
 * (예: 토1·일2, 토2·일2)에서도 특정인이 계속 밀리거나 몰리지 않는다.
 * (교대를 횟수보다 앞세우면 토·일 1자리씩일 때 제외요일자가 12개월간 한 번도 못 뽑혔다)
 */
const ALTERNATION_WEIGHT = 2;
const ALTERNATION_WEIGHT_WINDOW = 0.5; // 최근 3개월 기준일 때

function isAlternationExempt(member) {
  return !!(member.excludedWeekdays && member.excludedWeekdays.size);
}

function alternationClass(member, dow) {
  if (!dow) return 0;
  return lastShiftDow(member) === dow ? 1 : 0;
}

/**
 * 순위 계산에 더하는 "가상 횟수". 제외요일이 있는 사람(지게차 토/일 고정 인원,
 * 일요일 불가 현장 인원 등)은 애초에 교대할 수 없으니 유리도 불리도 없게 중간값을 준다.
 */
function alternationPenalty(member, dow) {
  // 최근 3개월 기준(member.win)에서는 횟수가 작아서(월 1회 안팎) 벌점을 크게 주면 교대가 공평성을 밀어낸다.
  // 26개월 시뮬레이션: 가중치 2 → 제외요일자가 다른 인원의 약 70%만 근무, 0.5 → 거의 동일(20 vs 21~23)하면서
  // 교대 예외는 약 9%. 그래서 이 기준에서는 가중치를 ALTERNATION_WEIGHT_WINDOW로 낮춘다.
  const w = member.win ? ALTERNATION_WEIGHT_WINDOW : ALTERNATION_WEIGHT;
  // 제외요일자(교대 불가)에게 상수 벌점을 주면 최근 3개월 기준에서는 그대로 "근무 횟수 격차"로 굳어진다.
  // 교대 가능한 사람은 벌점이 0인 순간(교대에 맞는 때)에 뽑히니까 실제로 내는 벌점이 거의 0이라서, 중간값을 주면
  // 계속 손해를 본다. 그래서 이 기준에서는 벌점 없이(0) 겨루게 하고, 누적횟수 기준에서는 예전 값(가중치÷2)을 쓴다.
  if (isAlternationExempt(member)) return member.win ? 0 : w / 2;
  return alternationClass(member, dow) * w;
}

function tieKeyFor(dow) {
  return (m) => `${fairCount(m) + alternationPenalty(m, dow)}|${alternationPenalty(m, dow)}|${fairCount(m)}|${m.lastWorked || ''}`;
}

function rankCandidates(members, eligible, owedSet, dow) {
  const candidates = members.filter(eligible);
  const penalty = new Map(candidates.map((m) => [m.name, alternationPenalty(m, dow)]));
  return candidates
    .slice()
    .sort((a, b) => {
      const pa = penalty.get(a.name);
      const pb = penalty.get(b.name);
      const countA = fairCount(a);
      const countB = fairCount(b);
      const scoreA = countA + pa;
      const scoreB = countB + pb;
      if (scoreA !== scoreB) return scoreA - scoreB;
      if (pa !== pb) return pa - pb;
      if (countA !== countB) return countA - countB;
      const aLast = a.lastWorked || '';
      const bLast = b.lastWorked || '';
      if (aLast !== bLast) return aLast < bLast ? -1 : 1;
      const aOwed = owedSet.has(a.name);
      const bOwed = owedSet.has(b.name);
      if (aOwed !== bOwed) return aOwed ? -1 : 1;
      return a.name.localeCompare(b.name, 'ko');
    });
}

function selectTopWithTieBreak(ranked, k, owedSet, keyOf) {
  const key = keyOf || ((m) => `${m.count}|${m.lastWorked || ''}`);
  const nextOwed = new Set(owedSet);
  if (k <= 0) return { selected: [], owedSet: nextOwed, shortfall: 0 };
  if (ranked.length <= k) {
    ranked.forEach((m) => nextOwed.delete(m.name));
    return { selected: ranked.slice(), owedSet: nextOwed, shortfall: k - ranked.length };
  }
  const selected = ranked.slice(0, k);
  const rest = ranked.slice(k);
  const boundaryKey = key(selected[k - 1]);
  const tiedSelected = selected.filter((m) => key(m) === boundaryKey);
  const tiedRest = rest.filter((m) => key(m) === boundaryKey);
  if (tiedRest.length > 0) {
    tiedSelected.forEach((m) => nextOwed.delete(m.name));
    tiedRest.forEach((m) => nextOwed.add(m.name));
  }
  return { selected, owedSet: nextOwed, shortfall: 0 };
}

// 교대 통계는 교대가 가능한 사람만 센다 (제외요일자는 어차피 교대할 수 없음)
function alternationTotal(selected) {
  return selected.filter((m) => !isAlternationExempt(m)).length;
}

function countAlternationExceptions(selected, dow) {
  return selected.filter((m) => !isAlternationExempt(m) && alternationClass(m, dow) === 1).length;
}

/**
 * 월 상한을 단계적으로 풀어가며 뽑는다. 앞 단계로 자리가 다 채워지면 뒤 단계는 쓰지 않는다.
 *   tierExcludes[0] : 평소 상한 (일반 2회 / 지난달 3회 한 사람 1회)
 *   tierExcludes[1] : 1단계로 모자랄 때 — 지난달 3회 한 사람도 2회까지 (일반은 그대로 2회)
 *   마지막        : 그래도 모자랄 때만 — 일반 인원이 3번째 근무 (hardExclude만 적용)
 * hardExclude(주말 연속 배정 금지, 최대 상한 도달 등)는 모든 단계에 적용된다.
 * 그래서 월 3회 근무는 정말 다른 방법이 없을 때만 생기고, 지난달 3회 한 사람이 2회가
 * 되는 것도 인원이 안 맞을 때뿐이다.
 */
function selectWithCapLadder(pool, needed, date, dow, hardExclude, tierExcludes, owedSet) {
  const taken = new Set();
  let selected = [];
  let owed = owedSet;
  let remaining = needed;
  const stages = [...tierExcludes, new Set()];
  for (const tierExclude of stages) {
    if (remaining <= 0) break;
    const eligible = (m) => isEligible(m, date) && !hardExclude.has(m.name) && !tierExclude.has(m.name) && !taken.has(m.name);
    const step = selectTopWithTieBreak(rankCandidates(pool, eligible, owed, dow), remaining, owed, tieKeyFor(dow));
    step.selected.forEach((m) => taken.add(m.name));
    selected = selected.concat(step.selected);
    owed = step.owedSet;
    remaining = step.shortfall;
  }
  return { selected, owedSet: owed, shortfall: remaining };
}

function assignGroupDay(members, date, dow, needed, hardExclude, tierExcludes, owedSet) {
  const { selected, owedSet: newOwed, shortfall } = selectWithCapLadder(members, needed, date, dow, hardExclude, tierExcludes, owedSet);
  return {
    picked: selected.map((m) => m.name),
    owedSet: newOwed,
    shortfall,
    altTotal: alternationTotal(selected),
    altExceptions: countAlternationExceptions(selected, dow),
  };
}

function assignFieldDay(members, date, dow, requiredTotal, hardExclude, tierExcludes, owedSet, label, lockedNames = []) {
  // 고정근무자는 로테이션 대상 아님, 매일 자동 포함 (이미 사람이 칸에 고정해 둔 경우는 다시 넣지 않는다)
  const scheduleWorkers = getScheduleWorkers(members).filter((m) => !lockedNames.includes(m.name));
  const rotationPool = members.filter((m) => !m.scheduleWorker);
  const rotationNeeded = Math.max(0, requiredTotal - scheduleWorkers.length);

  // 누적횟수(교대 반영) → 최근근무일 → 동률이력 순으로 뽑고, 월 상한은 단계적으로 푼다.
  const { selected, owedSet: newOwed, shortfall } = selectWithCapLadder(
    rotationPool, rotationNeeded, date, dow, hardExclude, tierExcludes, owedSet
  );

  const warnings = [];
  if (shortfall) warnings.push(`${label} 인원 부족 (${shortfall}명 미배정)`);

  return {
    picked: [...scheduleWorkers.map((m) => m.name), ...selected.map((m) => m.name)],
    owedSet: newOwed,
    warnings,
    altTotal: alternationTotal(selected),
    altExceptions: countAlternationExceptions(selected, dow),
  };
}

function cloneMembers(members) {
  return members.map((m) => ({ ...m }));
}

function bumpWorkingMembers(members, names, iso) {
  const nameSet = new Set(names);
  members.forEach((m) => {
    if (m.scheduleWorker) return; // 고정근무자는 로테이션 카운트 대상 아님
    if (nameSet.has(m.name)) {
      m.count += 1;
      if (m.win) m.win.total += 1;
      if (!m.lastWorked || iso > m.lastWorked) m.lastWorked = iso;
    }
  });
}

function namesWithLastWorked(members, iso) {
  return new Set(members.filter((m) => m.lastWorked === iso).map((m) => m.name));
}

/**
 * 같은 주말 토요일에 배정된 사람을 일요일 배정에서 제외 (규칙 9).
 * 이번 생성 배치 안에 그 주 토요일 기록이 있으면 그걸 그대로 쓰고 (lastWorked가
 * 우연히 더 미래 날짜로 남아있어도 흔들리지 않도록), 월초가 일요일이라 이번
 * 배치에 토요일이 없는 경우에만 원본 커밋 데이터의 lastWorked로 판단한다.
 */
function computeWeekendExclusion(prevEntry, dow, date, group, data) {
  if (dow !== 'sun') return new Set();
  if (prevEntry && prevEntry.dow === 'sat') {
    return prevEntry.isHoliday ? new Set() : new Set(prevEntry[group]);
  }
  return namesWithLastWorked(data[group].members, previousDayIso(date));
}

// 한 사람이 한 달에 배정될 수 있는 횟수 (관리자·지게차·현장 모두 동일).
//  - 평소 상한 2회: 먼저 이 안에서만 배정한다.
//  - 최대 3회: 2회 안에서는 자리를 못 채울 때만 예외로 허용한다 (드물어야 한다).
//  - 지난달에 3회 이상 근무한 사람은 이번 달 1회만. 그래도 인원이 안 맞으면 어쩔 수 없이 2회까지.
//  - 신규 입사자의 첫 배정 달은 무조건 1회.
const MONTHLY_SOFT_CAP = 2;
const MONTHLY_MAX_CAP = 3;
const LIMITED_MONTH_CAP = 1;
const LIMITED_MONTH_MAX_CAP = 2;

/** 입사 후 유예기간(기본 1개월)이 끝나 처음 배정 대상에 들어가는 바로 그 달인지 */
function isFirstEligibleMonth(member, year, month) {
  if (!member.joinDate) return false;
  const graceDate = addMonths(parseISODate(member.joinDate), CONFIG.rules.newHireGraceMonths);
  return graceDate.getFullYear() === year && graceDate.getMonth() === month - 1;
}

/** 배정 대상이 된 첫 달의 바로 다음 달인지 */
function isSecondEligibleMonth(member, year, month) {
  const first = firstEligibleYm(member);
  return !!first && shiftYm(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 1) === ymKey(year, month);
}

const SECOND_MONTH_CAP = 2;

/**
 * tier: 'soft' = 평소 상한, 'mid' = 지난달 3회 한 사람만 2회로 풀린 상태, 'max' = 절대 상한
 *   일반 인원      soft 2 / mid 2 / max 3
 *   지난달 3회한 사람 soft 1 / mid 2 / max 2
 *   신규 입사 첫 달   항상 1
 *   신규 입사 둘째 달  항상 2 (그 다음 달부터는 일반 인원과 같이 최근 3개월 기준)
 */
function monthlyCapFor(member, year, month, limitedNames, tier) {
  if (member && isFirstEligibleMonth(member, year, month)) return LIMITED_MONTH_CAP;
  if (member && isSecondEligibleMonth(member, year, month)) return SECOND_MONTH_CAP;
  if (member && limitedNames.has(member.name)) return tier === 'soft' ? LIMITED_MONTH_CAP : LIMITED_MONTH_MAX_CAP;
  return tier === 'max' ? MONTHLY_MAX_CAP : MONTHLY_SOFT_CAP;
}

function namesAtMonthlyCap(monthlyMap, members, year, month, limitedNames, tier) {
  const memberByName = new Map(members.map((m) => [m.name, m]));
  const result = new Set();
  monthlyMap.forEach((c, name) => {
    const cap = monthlyCapFor(memberByName.get(name), year, month, limitedNames, tier);
    if (c >= cap) result.add(name);
  });
  return result;
}

function bumpMonthlyPicks(monthlyMap, names, skipNames) {
  names.forEach((name) => {
    if (!name || (skipNames && skipNames.has(name))) return;
    monthlyMap.set(name, (monthlyMap.get(name) || 0) + 1);
  });
}

/* ------------------------------------------------------------
 * 부서 풀 — 현장 인원을 부서(운영1/운영2)별로 나눠 각자 자기 인원수만큼 배정한다.
 * 모드: 'all' = 풀필먼트2팀(모든 부서 합산), '운영2' = 그 부서 인원만.
 * Field 시트에 부서 구분이 없으면(옛 방식) 전체를 하나의 풀로 취급한다.
 * ------------------------------------------------------------ */
const MODE_BUTTONS = [
  { key: 'all', label: '풀필먼트2팀' },
  { key: '운영2', label: '운영2' },
];
const DEFAULT_MODE = '운영2';

function getModeLabel(mode) {
  const found = MODE_BUTTONS.find((b) => b.key === mode);
  return found ? found.label : mode;
}

function isDeptAware(data) {
  return data.field.members.some((m) => m.dept);
}

function poolIncludes(pool, member) {
  return pool.dept === null || member.dept === pool.dept;
}

function getFieldPools(data, mode) {
  const f = data.field;
  const withCols = (p) => ({ ...p, cols: Math.max(p.requiredSat, p.requiredSun) });
  if (!isDeptAware(data)) {
    const totals = f.legacyTotals || sumFieldTotals(f.byDept);
    return [withCols({ key: '', dept: null, ...totals })];
  }
  const allDepts = Object.keys(f.byDept).sort((a, b) => a.localeCompare(b, 'ko'));
  const depts = mode === 'all' ? allDepts : [mode];
  return depts.map((d) => withCols({ key: d, dept: d, ...(f.byDept[d] || ZERO_FIELD_CFG) }));
}

/** entry.fieldByDept(부서별 배정)를 이어 붙여 entry.field(평평한 이름 목록)를 다시 만든다 */
function syncFlatField(entry, pools) {
  entry.field = pools.flatMap((p) => entry.fieldByDept[p.key] || []);
}

/* ------------------------------------------------------------
 * 칸 고정 — 미리보기에서 마음에 드는 칸을 고정해 두면, "고정 제외 다시 배정"이 고정한 칸은
 * 그대로 두고 나머지 칸만 (고정된 사람의 근무 횟수까지 반영해서) 다시 공평하게 배정한다.
 * day.locks = { managers: [bool], forklift: [bool], field: { 부서키: [bool] } } — 칸 순서와 같은 위치.
 * ------------------------------------------------------------ */
function getSlotLocks(day, group, poolKey) {
  const l = day.locks;
  if (!l) return [];
  return group === 'field' ? ((l.field && l.field[poolKey]) || []) : (l[group] || []);
}

function ensureSlotLocks(day, group, poolKey) {
  if (!day.locks) day.locks = { managers: [], forklift: [], field: {} };
  if (group !== 'field') {
    if (!day.locks[group]) day.locks[group] = [];
    return day.locks[group];
  }
  if (!day.locks.field) day.locks.field = {};
  if (!day.locks.field[poolKey]) day.locks.field[poolKey] = [];
  return day.locks.field[poolKey];
}

/**
 * 이전 배정표(prev)의 그 날짜·그룹 칸 정보 — 총 칸 수(n: "+"로 늘린 칸 포함)와,
 * 고정된 칸의 이름(고정 안 된 칸은 빈 문자열). prev가 없으면(처음부터 만들 때) null.
 */
function planSlots(prevDay, group, poolKey, required) {
  if (!prevDay) return null;
  const list = group === 'field' ? (prevDay.fieldByDept[poolKey] || []) : (prevDay[group] || []);
  const locks = getSlotLocks(prevDay, group, poolKey);
  const n = Math.max(required, list.length);
  return { n, locked: Array.from({ length: n }, (_, i) => (locks[i] && list[i] ? list[i] : '')) };
}

/** 고정된 칸은 그 자리에 두고, 나머지 칸을 새로 뽑은 사람으로 앞에서부터 채운다 */
function fillSlots(plan, picked) {
  if (!plan) return picked;
  const out = plan.locked.slice();
  let k = 0;
  for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = picked[k++] || '';
  return out;
}

function generateMonthSchedule(year, month, data, mode = currentMode, prev = null) {
  const prevByDate = prev ? new Map(prev.days.map((d) => [d.date, d])) : null;
  const dates = getWeekendDatesInMonth(year, month);
  const workingMembers = {
    managers: cloneMembers(data.managers.members),
    forklift: cloneMembers(data.forklift.members),
    field: cloneMembers(data.field.members),
  };
  if (data.shiftLog) {
    const history = buildHistoryIndex(data.shiftLog);
    LIMIT_GROUPS.forEach((g) => attachFairnessWindow(workingMembers[g], g, history, year, month));
  }
  const owed = {
    managers: new Set(data.tieBreakHistory.managers),
    forklift: new Set(data.tieBreakHistory.forklift),
    field: new Set(data.tieBreakHistory.field),
  };
  // 이번 달 동안 각 사람이 몇 번 배정됐는지 — 월별 상한 체크용.
  // 고정근무자는 상한 대상이 아니라서 애초에 여기 안 쌓는다.
  const monthlyPicks = { managers: new Map(), forklift: new Map(), field: new Map() };
  // 지난달에 3회 이상 근무해서 이번 달엔 1회만 배정할 사람 (TieBreakHistory 시트의 "1회제한" 행)
  const limitsThisMonth = (data.tieBreakHistory.monthLimits || {})[ymKey(year, month)] || {};
  const limited = {
    managers: new Set(limitsThisMonth.managers || []),
    forklift: new Set(limitsThisMonth.forklift || []),
    field: new Set(limitsThisMonth.field || []),
  };
  const fieldScheduleWorkerNames = getScheduleWorkerNameSet(data.field.members);
  const pools = getFieldPools(data, mode);
  const stats = { altTotal: 0, altExceptions: 0 }; // 요일 교대 규칙을 지킨 건수/예외 건수

  const days = [];

  for (const { date, dow } of dates) {
    const iso = toISODate(date);
    const isHoliday = data.holidays.has(iso);
    const entry = {
      date: iso,
      dow,
      isHoliday,
      holidayLabel: isHoliday ? (data.holidays.get(iso) || '공휴일') : '',
      managers: [],
      forklift: [],
      field: [],
      fieldByDept: {},
      warnings: [],
    };

    if (isHoliday) {
      days.push(entry);
      continue;
    }

    const prevEntry = dow === 'sun' ? days[days.length - 1] : null;
    // 그룹별 제외 명단: hard = 절대 못 뽑음(주말 연속·최대 상한),
    // tiers = 평소 상한 → 지난달 3회자 2회 허용 순으로, 앞 단계로 자리가 안 차면 뒤 단계 순서로 풀린다
    const exclusionsFor = (group) => {
      const capNames = (tier) => namesAtMonthlyCap(monthlyPicks[group], workingMembers[group], year, month, limited[group], tier);
      return {
        hard: new Set([...computeWeekendExclusion(prevEntry, dow, date, group, data), ...capNames('max')]),
        tiers: [capNames('soft'), capNames('mid')],
      };
    };
    const exMgr = exclusionsFor('managers');
    const exFk = exclusionsFor('forklift');
    const exField = exclusionsFor('field');

    // 다시 배정할 때: 이전 표에서 고정한 칸의 사람은 그대로 두고(횟수·주말 제한에는 그대로 반영),
    // 고정 안 된 칸 수만큼만 새로 뽑는다. 칸 수는 "+"로 늘린 것까지 이전 표를 따른다.
    const prevDay = prevByDate ? prevByDate.get(iso) : null;
    const lockFlags = { managers: [], forklift: [], field: {} };
    const asLockedSet = (base, names) => new Set([...base, ...names]);

    const requiredM = getGroupRequired(data, 'managers', dow);
    const planM = planSlots(prevDay, 'managers', '', requiredM);
    const lockedM = planM ? planM.locked.filter(Boolean) : [];
    const mgrResult = assignGroupDay(
      workingMembers.managers, date, dow, planM ? planM.n - lockedM.length : requiredM,
      asLockedSet(exMgr.hard, lockedM), exMgr.tiers, owed.managers
    );
    entry.managers = fillSlots(planM, mgrResult.picked);
    lockFlags.managers = planM ? planM.locked.map(Boolean) : [];
    owed.managers = mgrResult.owedSet;
    if (mgrResult.shortfall) entry.warnings.push(`관리자 인원 부족 (${mgrResult.shortfall}명 미배정)`);
    stats.altTotal += mgrResult.altTotal;
    stats.altExceptions += mgrResult.altExceptions;

    const requiredF = getGroupRequired(data, 'forklift', dow);
    const planF = planSlots(prevDay, 'forklift', '', requiredF);
    const lockedF = planF ? planF.locked.filter(Boolean) : [];
    const fkResult = assignGroupDay(
      workingMembers.forklift, date, dow, planF ? planF.n - lockedF.length : requiredF,
      asLockedSet(exFk.hard, lockedF), exFk.tiers, owed.forklift
    );
    entry.forklift = fillSlots(planF, fkResult.picked);
    lockFlags.forklift = planF ? planF.locked.map(Boolean) : [];
    owed.forklift = fkResult.owedSet;
    if (fkResult.shortfall) entry.warnings.push(`지게차 인원 부족 (${fkResult.shortfall}명 미배정)`);
    stats.altTotal += fkResult.altTotal;
    stats.altExceptions += fkResult.altExceptions;

    pools.forEach((pool) => {
      const poolMembers = workingMembers.field.filter((m) => poolIncludes(pool, m));
      const required = dow === 'sat' ? pool.requiredSat : pool.requiredSun;
      const label = pool.dept ? `현장(${pool.dept})` : '현장';
      const planW = planSlots(prevDay, 'field', pool.key, required);
      const lockedW = planW ? planW.locked.filter(Boolean) : [];
      const fieldResult = assignFieldDay(
        poolMembers, date, dow, planW ? planW.n - lockedW.length : required,
        asLockedSet(exField.hard, lockedW), exField.tiers, owed.field, label, lockedW
      );
      entry.fieldByDept[pool.key] = fillSlots(planW, fieldResult.picked);
      lockFlags.field[pool.key] = planW ? planW.locked.map(Boolean) : [];
      owed.field = fieldResult.owedSet;
      entry.warnings.push(...fieldResult.warnings);
      stats.altTotal += fieldResult.altTotal;
      stats.altExceptions += fieldResult.altExceptions;
    });
    syncFlatField(entry, pools);
    if (prevDay) entry.locks = lockFlags;

    bumpWorkingMembers(workingMembers.managers, entry.managers, iso);
    bumpWorkingMembers(workingMembers.forklift, entry.forklift, iso);
    bumpWorkingMembers(workingMembers.field, entry.field, iso);

    bumpMonthlyPicks(monthlyPicks.managers, entry.managers);
    bumpMonthlyPicks(monthlyPicks.forklift, entry.forklift);
    bumpMonthlyPicks(monthlyPicks.field, entry.field, fieldScheduleWorkerNames);

    days.push(entry);
  }

  // 시트에 없는 이름은 제외하고 화면에 알릴 제한 대상만 남긴다 (오타는 시트 확인 배너로 따로 알려준다)
  const knownLimited = (group) => Array.from(limited[group]).filter((n) => workingMembers[group].some((m) => m.name === n));
  return {
    days, owed, workingMembers, pools, mode, stats, year, month,
    groupRequired: {
      managers: { ...(data.managers.required || DEFAULT_GROUP_REQUIRED) },
      forklift: { ...(data.forklift.required || DEFAULT_GROUP_REQUIRED) },
    },
    groupCols: { managers: getGroupCols(data, 'managers'), forklift: getGroupCols(data, 'forklift') },
    limited: { managers: knownLimited('managers'), forklift: knownLimited('forklift'), field: knownLimited('field') },
  };
}

/* ============================================================
 * 화면 렌더링
 * ============================================================ */
let DATA = null;
let currentDraft = null;

const MODE_STORAGE_KEY = 'ff2_mode';

function loadSavedMode() {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    if (MODE_BUTTONS.some((b) => b.key === saved)) return saved;
  } catch (e) { /* 저장소를 못 쓰는 환경이면 기본값 */ }
  return DEFAULT_MODE;
}

let currentMode = loadSavedMode();

const yearSelectEl = document.getElementById('yearSelect');
const monthSelectEl = document.getElementById('monthSelect');

function initSelectors() {
  const now = new Date();
  const curYear = now.getFullYear();
  for (let y = curYear - 1; y <= curYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = `${y}년`;
    if (y === curYear) opt.selected = true;
    yearSelectEl.appendChild(opt);
  }
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = `${m}월`;
    if (m === now.getMonth() + 1) opt.selected = true;
    monthSelectEl.appendChild(opt);
  }
}

function setStatus(msg, type) {
  const el = document.getElementById('statusLine');
  el.textContent = msg;
  el.className = 'status-line' + (type ? ` ${type}` : '');
}

function resetDraftUi(clearStatus = true) {
  currentDraft = null;
  document.getElementById('scheduleContainer').innerHTML =
    '<p class="empty-hint">연도/월을 선택하고 "자동배정 생성"을 눌러주세요.</p>';
  document.getElementById('btnCommit').disabled = true;
  document.getElementById('btnExport').disabled = true;
  document.getElementById('btnHandout').disabled = true;
  updateScheduleToolbar(null);
  if (clearStatus) setStatus('', '');
}

function decorateFieldName(name, data) {
  const member = data.field.members.find((m) => m.name === name);
  return member && member.fb ? `${name} (FB)` : name;
}

function getWeekendExcluded(draft, dayIdx, group, data) {
  const day = draft.days[dayIdx];
  const prevEntry = draft.days[dayIdx - 1];
  return computeWeekendExclusion(prevEntry, day.dow, parseISODate(day.date), group, data);
}

/** 이 칸에 지금 들어있는 이름. 현장은 부서(풀)별로 따로 저장돼 있다 */
function getSlotName(day, group, slotIndex, pool) {
  if (group === 'field' && pool) return (day.fieldByDept[pool.key] || [])[slotIndex] || '';
  return day[group][slotIndex] || '';
}

function buildSlotOptions(draft, dayIdx, group, slotIndex, data, pool) {
  const day = draft.days[dayIdx];
  const date = parseISODate(day.date);
  const currentName = getSlotName(day, group, slotIndex, pool);
  // 운영2 칸에는 운영2 인원만 후보로 보여준다 (부서 인원수가 부서별로 정해져 있으니까)
  const members = group === 'field' && pool && pool.dept !== null
    ? data.field.members.filter((m) => m.dept === pool.dept)
    : data[group].members;
  const usedElsewhereThisDay = new Set(day[group].filter((n) => n && n !== currentName));
  const excluded = getWeekendExcluded(draft, dayIdx, group, data);
  // 고정근무자는 매주 토·일 전부 근무하는 게 정상이라, "전날 근무해서 오늘 제외"
  // 규칙(규칙9)의 대상이 아니다 — 로테이션 인원에게만 적용한다.
  return members
    .filter((m) => isEligible(m, date))
    .filter((m) => !usedElsewhereThisDay.has(m.name))
    .filter((m) => m.scheduleWorker || !excluded.has(m.name))
    .map((m) => m.name);
}

function renderSlotSelect(draft, dayIdx, group, slotIndex, data, pool) {
  const day = draft.days[dayIdx];
  const currentName = getSlotName(day, group, slotIndex, pool);
  const options = buildSlotOptions(draft, dayIdx, group, slotIndex, data, pool);
  if (currentName && !options.includes(currentName)) options.unshift(currentName);

  const blankOpt = currentName ? '' : '<option value="">미배정</option>';
  const optsHtml = options
    .map((name) => {
      const label = group === 'field' ? decorateFieldName(name, data) : name;
      return `<option value="${escapeHtml(name)}" ${name === currentName ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');

  const poolAttr = group === 'field' && pool ? ` data-pool-key="${escapeHtml(pool.key)}"` : '';
  const locked = !!(currentName && getSlotLocks(day, group, pool ? pool.key : '')[slotIndex]);
  return `<select class="slot-select${locked ? ' is-locked' : ''}" data-day-idx="${dayIdx}" data-group="${group}" data-slot-index="${slotIndex}"${poolAttr}>${blankOpt}${optsHtml}</select>`;
}

/**
 * 화면·엑셀에 필요한 열 수. 자동배정이 정한 기본 열 수와, 사람이 "+"로 칸을 늘린
 * 날(바쁜 날)의 인원 중 더 큰 쪽을 쓴다.
 */
function getLayoutCols(draft) {
  const gc = draft.groupCols || { managers: 1, forklift: 1 };
  const cols = { managers: Math.max(1, gc.managers), forklift: Math.max(1, gc.forklift), pools: {} };
  draft.pools.forEach((p) => { cols.pools[p.key] = Math.max(1, p.cols); });
  draft.days.forEach((day) => {
    cols.managers = Math.max(cols.managers, day.managers.length);
    cols.forklift = Math.max(cols.forklift, day.forklift.length);
    draft.pools.forEach((p) => {
      cols.pools[p.key] = Math.max(cols.pools[p.key], (day.fieldByDept[p.key] || []).length);
    });
  });
  return cols;
}

function renderSchedule(draft, data) {
  const container = document.getElementById('scheduleContainer');
  if (!draft || !draft.days.length) {
    container.innerHTML = '<p class="empty-hint">배정 결과가 없습니다.</p>';
    return;
  }

  const pools = draft.pools;
  const multiPool = pools.length > 1;
  const cols = getLayoutCols(draft);
  const fieldCols = pools.reduce((sum, p) => sum + cols.pools[p.key], 0);
  const gr = draft.groupRequired || { managers: DEFAULT_GROUP_REQUIRED, forklift: DEFAULT_GROUP_REQUIRED };
  const totalCols = 1 + cols.managers + cols.forklift + fieldCols;

  let html = '<table class="schedule-table"><thead><tr>';
  html += '<th>날짜</th>';
  groupHeaderLabels('관리자', cols.managers).forEach((h) => { html += `<th>${h}</th>`; });
  groupHeaderLabels('지게차', cols.forklift).forEach((h) => { html += `<th>${h}</th>`; });
  pools.forEach((p) => {
    for (let i = 0; i < cols.pools[p.key]; i++) html += `<th>${multiPool ? `${escapeHtml(p.dept)} ` : ''}현장${i + 1}</th>`;
  });
  html += '</tr></thead><tbody>';

  // 칸 하나 = 선택 목록. 그 날짜·그룹의 마지막 칸 옆에는 "+"(칸 추가) 버튼을, 필요인원을 넘어서
  // 사람이 늘린 칸 옆에는 "×"(삭제) 버튼을 붙인다.
  const dataAttrs = (dayIdx, group, i, pool) =>
    `data-day-idx="${dayIdx}" data-group="${group}" data-slot-index="${i}"${group === 'field' && pool ? ` data-pool-key="${escapeHtml(pool.key)}"` : ''}`;
  const groupLabelOf = (group, pool) => (group === 'managers' ? '관리자' : group === 'forklift' ? '지게차' : (pool && pool.dept ? `${pool.dept} 현장` : '현장'));
  const addBtn = (dayIdx, group, i, pool) =>
    `<button type="button" class="slot-add" title="${escapeHtml(groupLabelOf(group, pool))} 근무 칸 추가 (바쁜 날)" aria-label="${escapeHtml(groupLabelOf(group, pool))} 근무 칸 추가" ${dataAttrs(dayIdx, group, i, pool)}>+</button>`;
  const lockBtn = (dayIdx, group, i, pool) => {
    const day = draft.days[dayIdx];
    if (!getSlotName(day, group, i, pool)) return ''; // 비어 있는 칸은 고정할 수 없다
    const locked = !!getSlotLocks(day, group, pool ? pool.key : '')[i];
    const tip = locked ? '고정됨 — 다시 배정해도 바뀌지 않습니다 (눌러서 해제)' : '눌러서 이 칸을 고정 (다시 배정해도 바뀌지 않음)';
    return `<button type="button" class="slot-lock${locked ? ' is-locked' : ''}" aria-pressed="${locked}" title="${tip}" aria-label="${tip}" ${dataAttrs(dayIdx, group, i, pool)}>${locked ? '🔒' : '🔓'}</button>`;
  };
  const removeBtn = (dayIdx, group, i, pool) =>
    `<button type="button" class="slot-remove" title="추가한 칸 삭제" aria-label="추가한 칸 삭제" ${dataAttrs(dayIdx, group, i, pool)}>×</button>`;
  const groupCells = (dayIdx, group, list, required, colCount, pool) => {
    const lastIdx = Math.max(list.length, required) - 1;
    let out = '';
    for (let i = 0; i < colCount; i++) {
      const hasSlot = i < list.length || i < required;
      const addHere = hasSlot ? i === lastIdx : (lastIdx < 0 && i === 0);
      if (!hasSlot) {
        out += addHere ? `<td><div class="slot-wrap"><span class="slot-dash">—</span>${addBtn(dayIdx, group, i, pool)}</div></td>` : '<td>—</td>';
        continue;
      }
      const extra = i >= required;
      out += `<td><div class="slot-wrap">${renderSlotSelect(draft, dayIdx, group, i, data, pool)}${lockBtn(dayIdx, group, i, pool)}${extra ? removeBtn(dayIdx, group, i, pool) : ''}${addHere ? addBtn(dayIdx, group, i, pool) : ''}</div></td>`;
    }
    return out;
  };

  // 수정까지 반영한 현재 배정표에서, 월 3번째 이상 근무가 되는 날에 참고 표시를 붙인다
  const skipField = getScheduleWorkerNameSet(data.field.members);
  const runTally = { managers: new Map(), forklift: new Map(), field: new Map() };

  draft.days.forEach((day, dayIdx) => {
    const notes = [];
    if (!day.isHoliday) {
      LIMIT_GROUPS.forEach((g) => {
        day[g].filter((name) => name && !(g === 'field' && skipField.has(name))).forEach((name) => {
          const c = (runTally[g].get(name) || 0) + 1;
          runTally[g].set(name, c);
          if (c >= MONTHLY_MAX_CAP) notes.push(`${name} 이번 달 ${c}번째 근무`);
          else if (c >= LIMITED_MONTH_MAX_CAP && (draft.limited[g] || []).includes(name)) {
            notes.push(`${name} 지난달 3회 근무 → 이번 달 ${c}번째 근무 (인원 부족)`);
          }
        });
      });
    }
    const weekdayLabel = day.dow === 'sat' ? '토' : '일';
    const rowClass = day.isHoliday ? 'is-holiday' : '';
    const dateCellClass = day.isHoliday ? 'date-cell holiday-text' : 'date-cell';

    html += `<tr class="${rowClass}">`;
    html += `<td class="${dateCellClass}">${formatKoreanDate(day.date)}(${weekdayLabel})</td>`;

    if (day.isHoliday) {
      html += `<td colspan="${totalCols - 1}" class="holiday-row-label">공휴일 휴무 (${escapeHtml(day.holidayLabel)})</td>`;
    } else {
      ['managers', 'forklift'].forEach((g) => {
        const required = day.dow === 'sat' ? gr[g].sat : gr[g].sun;
        html += groupCells(dayIdx, g, day[g], required, cols[g], null);
      });
      pools.forEach((pool) => {
        const required = day.dow === 'sat' ? pool.requiredSat : pool.requiredSun;
        html += groupCells(dayIdx, 'field', day.fieldByDept[pool.key] || [], required, cols.pools[pool.key], pool);
      });
    }
    html += '</tr>';

    if (!day.isHoliday && (day.warnings.length || notes.length)) {
      html += `<tr class="${rowClass}"><td></td><td colspan="${totalCols - 1}">`;
      html += day.warnings.map((w) => `<span class="warn-tag">${escapeHtml(w)}</span>`).join(' ');
      html += notes.map((n) => `<span class="note-tag">${escapeHtml(n)}</span>`).join(' ');
      html += '</td></tr>';
    }
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('select.slot-select').forEach((sel) => {
    sel.addEventListener('change', onSlotChange);
  });
  container.querySelectorAll('button.slot-add').forEach((b) => b.addEventListener('click', onSlotAdd));
  container.querySelectorAll('button.slot-remove').forEach((b) => b.addEventListener('click', onSlotRemove));
  container.querySelectorAll('button.slot-lock').forEach((b) => b.addEventListener('click', onSlotLockToggle));
  updateScheduleToolbar(draft);
}

/** 그 날짜·그룹의 배정 목록(배열)과 그날 자동배정이 정한 필요인원 */
function getDaySlotList(day, group, poolKey) {
  if (group === 'field') {
    const pool = currentDraft.pools.find((pl) => pl.key === poolKey);
    const required = pool ? (day.dow === 'sat' ? pool.requiredSat : pool.requiredSun) : 0;
    if (!day.fieldByDept[poolKey]) day.fieldByDept[poolKey] = [];
    return { slots: day.fieldByDept[poolKey], required, label: pool && pool.dept ? `${pool.dept} 현장` : '현장' };
  }
  const gr = currentDraft.groupRequired || { managers: DEFAULT_GROUP_REQUIRED, forklift: DEFAULT_GROUP_REQUIRED };
  const required = day.dow === 'sat' ? gr[group].sat : gr[group].sun;
  return { slots: day[group], required, label: group === 'managers' ? '관리자' : '지게차' };
}

/** 고정된(사람 이름이 있는) 칸 수 */
function countLockedSlots(draft) {
  let n = 0;
  draft.days.forEach((day) => {
    if (day.isHoliday) return;
    ['managers', 'forklift'].forEach((g) => day[g].forEach((name, i) => { if (name && getSlotLocks(day, g, '')[i]) n += 1; }));
    draft.pools.forEach((pool) => (day.fieldByDept[pool.key] || []).forEach((name, i) => {
      if (name && getSlotLocks(day, 'field', pool.key)[i]) n += 1;
    }));
  });
  return n;
}

/** 배정표 위 도구줄(다시 배정 / 전체 고정 / 전체 해제)을 보여주고 고정 칸 수를 갱신 */
function updateScheduleToolbar(draft) {
  const bar = document.getElementById('scheduleToolbar');
  if (!bar) return;
  bar.hidden = !draft;
  if (draft) document.getElementById('lockCount').textContent = `고정 ${countLockedSlots(draft)}칸`;
}

/** 자물쇠 버튼 — 그 칸을 고정/해제 */
function onSlotLockToggle(evt) {
  const btn = evt.currentTarget;
  const day = currentDraft.days[Number(btn.dataset.dayIdx)];
  const locks = ensureSlotLocks(day, btn.dataset.group, btn.dataset.poolKey || '');
  const i = Number(btn.dataset.slotIndex);
  locks[i] = !locks[i];
  renderSchedule(currentDraft, DATA);
}

/** 전체 고정(사람이 들어 있는 모든 칸) / 전체 해제 */
function setAllLocks(value) {
  if (!currentDraft) return;
  currentDraft.days.forEach((day) => {
    if (day.isHoliday) return;
    ['managers', 'forklift'].forEach((g) => day[g].forEach((name, i) => { ensureSlotLocks(day, g, '')[i] = value && !!name; }));
    currentDraft.pools.forEach((pool) => (day.fieldByDept[pool.key] || []).forEach((name, i) => {
      ensureSlotLocks(day, 'field', pool.key)[i] = value && !!name;
    }));
  });
  renderSchedule(currentDraft, DATA);
  setStatus(value ? '사람이 들어 있는 모든 칸을 고정했습니다. 바꾸고 싶은 칸의 자물쇠만 풀고 "고정 제외 다시 배정"을 눌러주세요.' : '모든 고정을 해제했습니다.', 'success');
}

/** "고정 제외 다시 배정" — 고정한 칸은 그대로 두고 나머지를 공평 규칙으로 다시 배정 */
function onReassign() {
  if (!currentDraft || !DATA) return;
  const lockedBefore = countLockedSlots(currentDraft);
  const mode = currentDraft.mode;
  currentDraft = generateMonthSchedule(currentDraft.year, currentDraft.month, DATA, mode, currentDraft);
  renderSchedule(currentDraft, DATA);
  setStatus(`[${getModeLabel(mode)}] 고정한 ${lockedBefore}칸은 그대로 두고 나머지를 다시 배정했습니다.${draftSummaryMessage(currentDraft)} 저장 전에 검토해주세요.`, 'success');
}

/** "+ 버튼" — 바쁜 날에 근무 칸을 한 칸 더 늘린다 (추가한 칸은 미배정으로 시작) */
function onSlotAdd(evt) {
  const btn = evt.currentTarget;
  const day = currentDraft.days[Number(btn.dataset.dayIdx)];
  const group = btn.dataset.group;
  const { slots, required, label } = getDaySlotList(day, group, btn.dataset.poolKey || '');
  while (slots.length < required) slots.push(''); // 자동배정이 못 채운 칸이 있어도 새 칸이 항상 맨 뒤에 생기게
  slots.push('');
  if (group === 'field') syncFlatField(day, currentDraft.pools);
  renderSchedule(currentDraft, DATA);
  setStatus(`${formatKoreanDate(day.date)} ${label}에 칸을 하나 추가했습니다. 추가한 칸에서 근무자를 선택해 주세요. (칸 옆 × 로 삭제)`, 'success');
}

/** 추가했던 칸 삭제 — 필요인원을 넘는 칸에만 삭제 버튼이 나온다 */
function onSlotRemove(evt) {
  const btn = evt.currentTarget;
  const day = currentDraft.days[Number(btn.dataset.dayIdx)];
  const group = btn.dataset.group;
  const { slots, label } = getDaySlotList(day, group, btn.dataset.poolKey || '');
  slots.splice(Number(btn.dataset.slotIndex), 1);
  ensureSlotLocks(day, group, btn.dataset.poolKey || '').splice(Number(btn.dataset.slotIndex), 1);
  if (group === 'field') syncFlatField(day, currentDraft.pools);
  renderSchedule(currentDraft, DATA);
  setStatus(`${formatKoreanDate(day.date)} ${label}의 추가한 칸을 삭제했습니다.`, 'success');
}

function onSlotChange(evt) {
  const sel = evt.target;
  const dayIdx = Number(sel.dataset.dayIdx);
  const group = sel.dataset.group;
  const slotIndex = Number(sel.dataset.slotIndex);
  const day = currentDraft.days[dayIdx];
  if (group === 'field') {
    const key = sel.dataset.poolKey || '';
    const picks = day.fieldByDept[key] || (day.fieldByDept[key] = []);
    while (picks.length < slotIndex) picks.push('');
    picks[slotIndex] = sel.value;
    syncFlatField(day, currentDraft.pools);
  } else {
    day[group][slotIndex] = sel.value;
  }
  // 직접 고른 칸은 자동으로 고정한다 (다시 배정해도 유지). 미배정으로 비우면 고정도 풀린다.
  ensureSlotLocks(day, group, sel.dataset.poolKey || '')[slotIndex] = sel.value !== '';
  renderSchedule(currentDraft, DATA);
  setStatus('칸을 수정하고 고정했습니다(자물쇠로 해제 가능). 나머지 칸을 다시 배정하려면 "고정 제외 다시 배정"을 누르세요.', 'success');
}

/** 시트 상태 경고(부서 미입력, 읽을 수 없는 날짜 등)를 배너로 보여준다 */
function renderDataWarnings(data) {
  const el = document.getElementById('dataWarnings');
  const warnings = (data && data.warnings) || [];
  if (!warnings.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<strong>시트 확인이 필요합니다</strong><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
  el.hidden = false;
}

function renderRosterStatus(data) {
  const container = document.getElementById('rosterContainer');
  // 현장은 선택한 모드(풀필먼트2팀/운영2)에 해당하는 부서 인원만 보여준다
  const pools = getFieldPools(data, currentMode);
  const fieldScopeMembers = data.field.members.filter((m) => pools.some((p) => poolIncludes(p, m)));
  const showDeptTag = pools.length > 1;
  // 선택한 연·월에 "지난달 3회 근무로 1회만 배정"되는 사람 표시
  const limitsThisMonth = (data.tieBreakHistory.monthLimits || {})[ymKey(Number(yearSelectEl.value), Number(monthSelectEl.value))] || {};
  const limitTag = (groupKey, name) => ((limitsThisMonth[groupKey] || []).includes(name) ? '<span class="limit-tag">1회 제한</span>' : '');
  // ScheduleLog가 연결돼 있으면 "최근 3개월" 칸을 함께 보여준다 (배정 순위의 기준이 되는 값)
  const history = data.shiftLog ? buildHistoryIndex(data.shiftLog) : null;
  const selYear = Number(yearSelectEl.value);
  const selMonth = Number(monthSelectEl.value);
  const recentCell = (groupKey, m) => {
    if (!history) return '';
    const prior = priorLoggedMonths(history, groupKey, selYear, selMonth);
    const first = firstEligibleYm(m);
    const usable = prior.filter((ym) => !first || ym >= first);
    if (!usable.length) return '<td class="num">-</td>';
    const byMonth = history.counts[groupKey].get(m.name);
    const total = usable.reduce((sum, ym) => sum + ((byMonth && byMonth.get(ym)) || 0), 0);
    const note = usable.length < 3 ? ` <span class="recent-note">(${usable.length}개월치)</span>` : '';
    return `<td class="num">${total}${note}</td>`;
  };
  const scopeSuffix = pools.length === 1 && pools[0].dept ? ` · ${pools[0].dept}` : '';
  const fieldScheduleWorkerNames = getScheduleWorkers(fieldScopeMembers).map((m) => m.name);
  const fieldTitle = fieldScheduleWorkerNames.length
    ? `${data.field.label}${scopeSuffix} (+ ${fieldScheduleWorkerNames.join(', ')} 고정)`
    : `${data.field.label}${scopeSuffix}`;
  const groups = [
    { key: 'managers', title: data.managers.label, members: data.managers.members },
    { key: 'forklift', title: data.forklift.label, members: data.forklift.members },
    { key: 'field', title: fieldTitle, members: fieldScopeMembers },
  ];

  container.innerHTML = groups
    .map((g) => {
      const members = g.members
        .filter((m) => !m.scheduleWorker)
        .slice()
        .sort((a, b) => a.count - b.count || (a.lastWorked || '').localeCompare(b.lastWorked || ''));
      const rows = members
        .map(
          (m) => `
        <tr>
          <td>${escapeHtml(m.name)}${limitTag(g.key, m.name)}${g.key === 'field' && m.fb ? '<span class="fb-tag">FB</span>' : ''}${g.key === 'field' && showDeptTag && m.dept ? `<span class="dept-tag">${escapeHtml(m.dept)}</span>` : ''}</td>
          <td class="num">${m.count}</td>
          ${recentCell(g.key, m)}
          <td>${m.lastWorked || '-'}</td>
        </tr>`
        )
        .join('');
      return `
      <div class="roster-card">
        <h3>${escapeHtml(g.title)}</h3>
        <table class="roster-table">
          <thead><tr><th>이름</th><th>누적</th>${history ? '<th title="직전 3개월(기록 있는 달) 근무 횟수">최근 3개월</th>' : ''}<th>최근근무일</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join('');
}

/* ============================================================
 * 저장 (Apps Script POST) / 엑셀 다운로드
 * ============================================================ */
/** 화면에 보이는(수정까지 반영된) 배정표 기준으로 그룹별 "이번 달 몇 번 근무" 집계 */
function computeMonthlyTallies(draft, data) {
  const skipField = getScheduleWorkerNameSet(data.field.members);
  const tallies = { managers: new Map(), forklift: new Map(), field: new Map() };
  draft.days.forEach((day) => {
    if (day.isHoliday) return;
    LIMIT_GROUPS.forEach((g) => {
      day[g]
        .filter((name) => name && !(g === 'field' && skipField.has(name)))
        .forEach((name) => tallies[g].set(name, (tallies[g].get(name) || 0) + 1));
    });
  });
  return tallies;
}

/** 이번 달 3회 이상 근무한 사람 (그룹별 [{name, count}]) */
function findMaxedOut(tallies) {
  const out = {};
  LIMIT_GROUPS.forEach((g) => {
    out[g] = Array.from(tallies[g].entries())
      .filter(([, c]) => c >= MONTHLY_MAX_CAP)
      .map(([name, count]) => ({ name, count }));
  });
  return out;
}

/**
 * 저장 시 다음 달 "1회제한" 명단을 갱신한다. 이번 달 3회 근무자를 다음 달에 추가하고,
 * 이미 지난 달 항목은 정리하며, 직접 적어둔 이후 달 항목은 그대로 둔다.
 */
function mergeMonthLimits(existing, draftYm, targetYm, maxedOut) {
  const out = {};
  Object.entries(existing || {}).forEach(([ym, groups]) => {
    if (ym <= draftYm) return;
    LIMIT_GROUPS.forEach((g) => (groups[g] || []).forEach((name) => addMonthLimit(out, ym, g, name)));
  });
  LIMIT_GROUPS.forEach((g) => maxedOut[g].forEach(({ name }) => addMonthLimit(out, targetYm, g, name)));
  return out;
}

function bumpDelta(map, name, iso) {
  const cur = map.get(name) || { count: 0, maxDate: '' };
  cur.count += 1;
  if (iso > cur.maxDate) cur.maxDate = iso;
  map.set(name, cur);
}

function buildCommitPayload(draft, data) {
  const deltas = { managers: new Map(), forklift: new Map(), field: new Map() };
  const scheduleLogRows = [];
  const fieldScheduleWorkerNames = getScheduleWorkerNameSet(data.field.members);
  const deptByName = new Map(data.field.members.map((m) => [m.name, m.dept]));
  // ScheduleLog는 컬럼 구조를 바꾸면 Apps Script 재배포가 필요해서, 부서는 그룹 칸에 "현장·운영2"처럼 적는다.
  const fieldGroupLabel = (name) => {
    const dept = deptByName.get(name);
    return dept ? `${data.field.label}·${dept}` : data.field.label;
  };

  draft.days.forEach((day) => {
    if (day.isHoliday) return;
    const weekday = day.dow === 'sat' ? '토' : '일';

    day.managers.filter(Boolean).forEach((name) => {
      bumpDelta(deltas.managers, name, day.date);
      scheduleLogRows.push({ date: day.date, weekday, group: data.managers.label, name });
    });
    day.forklift.filter(Boolean).forEach((name) => {
      bumpDelta(deltas.forklift, name, day.date);
      scheduleLogRows.push({ date: day.date, weekday, group: data.forklift.label, name });
    });
    day.field
      .filter((name) => name && !fieldScheduleWorkerNames.has(name))
      .forEach((name) => {
        bumpDelta(deltas.field, name, day.date);
        scheduleLogRows.push({ date: day.date, weekday, group: fieldGroupLabel(name), name });
      });
  });

  const rosterUpdates = {};
  ['managers', 'forklift', 'field'].forEach((group) => {
    rosterUpdates[group] = data[group].members
      .map((m) => {
        const delta = deltas[group].get(m.name);
        if (!delta) return null;
        const newCount = m.count + delta.count;
        const newLastWorked = m.lastWorked && m.lastWorked > delta.maxDate ? m.lastWorked : delta.maxDate;
        return { name: m.name, count: newCount, lastWorked: newLastWorked };
      })
      .filter(Boolean);
  });

  // 이번 달 3회 이상 근무한 사람은 다음 달 1회만 배정하도록 TieBreakHistory에 "1회제한" 행으로 남긴다.
  // (시트 구조·Apps Script는 그대로 — 그룹 칸에 "1회제한 2026-11 현장"처럼 적는다)
  const year = draft.year || Number(draft.days[0].date.slice(0, 4));
  const month = draft.month || Number(draft.days[0].date.slice(5, 7));
  const monthLimits = mergeMonthLimits(
    data.tieBreakHistory.monthLimits, ymKey(year, month), nextYmKey(year, month),
    findMaxedOut(computeMonthlyTallies(draft, data))
  );
  const tieBreakHistory = {
    managers: Array.from(draft.owed.managers),
    forklift: Array.from(draft.owed.forklift),
    field: Array.from(draft.owed.field),
  };
  Object.entries(monthLimits).forEach(([ym, groups]) => {
    LIMIT_GROUPS.forEach((g) => {
      if (groups[g].length) tieBreakHistory[`${LIMIT_ROW_PREFIX} ${ym} ${LIMIT_GROUP_LABELS[g]}`] = groups[g];
    });
  });

  return { rosterUpdates, scheduleLogRows, tieBreakHistory };
}

function applyCommitLocally(payload, data) {
  ['managers', 'forklift', 'field'].forEach((group) => {
    payload.rosterUpdates[group].forEach((u) => {
      const m = data[group].members.find((mm) => mm.name === u.name);
      if (m) {
        m.count = u.count;
        m.lastWorked = u.lastWorked;
      }
    });
  });
  const tieBreakHistory = { managers: [], forklift: [], field: [], monthLimits: {} };
  Object.entries(payload.tieBreakHistory).forEach(([key, names]) => {
    const limit = parseLimitGroupLabel(key);
    if (limit) names.forEach((name) => addMonthLimit(tieBreakHistory.monthLimits, limit.ym, limit.group, name));
    else tieBreakHistory[key] = names;
  });
  data.tieBreakHistory = tieBreakHistory;
  if (data.shiftLog) {
    (payload.scheduleLogRows || []).forEach((r) => {
      const group = logGroupKey(r.group);
      if (group && r.name && r.date) data.shiftLog.push({ date: r.date, group, name: r.name });
    });
  }
}

async function onCommit() {
  if (!currentDraft) return;
  setStatus('저장 중입니다...', '');
  document.getElementById('btnCommit').disabled = true;
  try {
    const payload = buildCommitPayload(currentDraft, DATA);
    if (isConfigured()) {
      const res = await fetch(CONFIG.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '저장 실패');
    } else {
      console.log('[MOCK 모드] 실제로는 저장되지 않았습니다. payload:', payload);
    }
    applyCommitLocally(payload, DATA);
    renderRosterStatus(DATA);
    setStatus('저장이 완료되었습니다.', 'success');
  } catch (err) {
    setStatus(`저장 실패: ${err.message}`, 'error');
    document.getElementById('btnCommit').disabled = false;
  }
}

async function onExport() {
  if (!currentDraft) return;
  setStatus('엑셀 파일을 만드는 중입니다...', '');
  try {
    const wb = new ExcelJS.Workbook();
    const monthLabel = `${yearSelectEl.value}년 ${monthSelectEl.value}월`;
    const sheet = wb.addWorksheet(monthLabel, { properties: { tabColor: { argb: 'FFDBDBDB' } } });

    const pools = currentDraft.pools;
    const multiPool = pools.length > 1;
    const cols = getLayoutCols(currentDraft); // "+"로 늘린 칸까지 포함
    const fieldHeaders = pools.flatMap((p) =>
      Array.from({ length: cols.pools[p.key] }, (_, i) => `${multiPool ? `${p.dept} ` : ''}현장${i + 1}`)
    );
    const headers = ['날짜', ...groupHeaderLabels('관리자', cols.managers), ...groupHeaderLabels('지게차', cols.forklift), ...fieldHeaders];
    sheet.addRow(headers);

    const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECECEC' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = border;
    });

    currentDraft.days.forEach((day) => {
      const rowValues = [toExcelDate(day.date)];
      if (day.isHoliday) {
        rowValues.push(`공휴일 휴무 (${day.holidayLabel})`, ...Array(headers.length - 2).fill(''));
      } else {
        ['managers', 'forklift'].forEach((g) => {
          for (let i = 0; i < cols[g]; i++) rowValues.push(day[g][i] || '');
        });
        pools.forEach((p) => {
          const picks = day.fieldByDept[p.key] || [];
          for (let i = 0; i < cols.pools[p.key]; i++) rowValues.push(picks[i] || '');
        });
      }
      const row = sheet.addRow(rowValues);
      row.eachCell((cell) => {
        cell.font = { name: '맑은 고딕' };
        cell.border = border;
        cell.alignment = { vertical: 'middle' };
      });

      const dateCell = row.getCell(1);
      dateCell.numFmt = 'mm"월" dd"일"(aaa)';

      if (day.isHoliday) {
        dateCell.font = { name: '맑은 고딕', color: { argb: 'FF4472C4' }, bold: true };
        row.getCell(2).font = { name: '맑은 고딕', color: { argb: 'FF4472C4' }, bold: true };
      }
    });

    sheet.columns.forEach((col, idx) => {
      col.width = idx === 0 ? 18 : 14;
    });
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const fileName = `${getModeLabel(currentDraft.mode)}_근무표_${yearSelectEl.value}${String(monthSelectEl.value).padStart(2, '0')}.xlsx`;
    saveAs(blob, fileName);
    setStatus('엑셀 다운로드가 완료되었습니다.', 'success');
  } catch (err) {
    setStatus(`엑셀 생성 실패: ${err.message}`, 'error');
  }
}

/* ============================================================
 * 현장전달문서 (PDF) — 지게차/현장 근무자에게 나눠줄 문서.
 * 실제 PDF 라이브러리 대신 인쇄 전용 화면을 새 창으로 띄우고
 * "PDF로 저장"을 쓰게 한다. 브라우저 인쇄 기능은 한글 폰트를
 * 그대로 쓰기 때문에, 폰트를 파일에 통째로 내장해야 하는
 * jsPDF류보다 훨씬 가볍고 깨질 일이 없다.
 * ============================================================ */
function buildHandoutRows(draft, data) {
  const forkliftRows = [];
  const fieldRows = [];
  const fieldScheduleWorkerNames = getScheduleWorkerNameSet(data.field.members);
  draft.days.forEach((day) => {
    if (day.isHoliday) return;
    const weekdayLabel = day.dow === 'sat' ? '토' : '일';
    const dateLabel = `${formatKoreanDate(day.date)}(${weekdayLabel})`;
    day.forklift.forEach((name) => { if (name) forkliftRows.push({ date: dateLabel, name }); });
    day.field.forEach((name) => {
      if (name && !fieldScheduleWorkerNames.has(name)) fieldRows.push({ date: dateLabel, name });
    });
  });
  return { forkliftRows, fieldRows };
}

function buildCalendarWeeks(year, month, draftByDate, data) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISODate(new Date(year, month - 1, d));
    const entry = draftByDate.get(iso);
    const isHoliday = data.holidays.has(iso);
    const names = [];
    if (entry && !entry.isHoliday) {
      entry.forklift.forEach((n) => { if (n) names.push(n); });
      entry.field.forEach((n) => { if (n) names.push(n); });
    }
    cells.push({
      day: d,
      isHoliday,
      holidayLabel: isHoliday ? (data.holidays.get(iso) || '휴무') : '',
      names,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function buildAssignColumnHtml(rows) {
  if (!rows.length) return '<table class="assign-table"><thead><tr><th style="width:110px;">날짜</th><th>이름</th><th class="blank-cell">대체휴무일</th></tr></thead><tbody><tr><td colspan="3">배정 내역이 없습니다.</td></tr></tbody></table>';
  const rowsHtml = rows.map((r) => `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.name)}</td><td class="blank-cell"></td></tr>`).join('');
  return `<table class="assign-table"><thead><tr><th style="width:110px;">날짜</th><th>이름</th><th class="blank-cell">대체휴무일</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function buildHandoutHtml(year, month, forkliftRows, fieldRows, weeks, scopeLabel) {
  const weekDayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 지게차는 보통 표 하나로 충분하고, 현장은 인원이 많아서 한 페이지에 들어가도록
  // 좌우 2단으로 나눠서 배치한다. 지게차도 행이 많아지면(하루 2명 이상 등) 똑같이 2단으로 나눈다.
  const forkliftHalf = Math.ceil(forkliftRows.length / 2);
  const forkliftTableHtml = forkliftRows.length > 10
    ? `<div class="assign-columns">${buildAssignColumnHtml(forkliftRows.slice(0, forkliftHalf))}${buildAssignColumnHtml(forkliftRows.slice(forkliftHalf))}</div>`
    : buildAssignColumnHtml(forkliftRows);
  const fieldHalf = Math.ceil(fieldRows.length / 2);
  const fieldColumnsHtml = `<div class="assign-columns">${buildAssignColumnHtml(fieldRows.slice(0, fieldHalf))}${buildAssignColumnHtml(fieldRows.slice(fieldHalf))}</div>`;

  const calendarHtml = weeks
    .map((week) => `<tr>${week
      .map((cell) => {
        if (!cell) return '<td></td>';
        if (cell.isHoliday) {
          return `<td><div class="cal-date cal-holiday">${cell.day}</div><div class="cal-offday-badge">휴무 (${escapeHtml(cell.holidayLabel)})</div></td>`;
        }
        const namesHtml = cell.names.length
          ? `<div class="cal-names">${cell.names.map(escapeHtml).join('<br>')}</div>`
          : '';
        return `<td><div class="cal-date">${cell.day}</div>${namesHtml}</td>`;
      })
      .join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>${escapeHtml(scopeLabel)}_현장전달문서_${year}${String(month).padStart(2, '0')}</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Pretendard", "Malgun Gothic", "맑은 고딕", sans-serif; color: #111; margin: 0; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  .sub { font-size: 11px; color: #555; margin: 0 0 14px; }
  h2.section-title { font-size: 13px; margin: 14px 0 6px; border-left: 4px solid #4472C4; padding-left: 8px; }
  .assign-columns { display: flex; gap: 10px; }
  .assign-columns > table { flex: 1; min-width: 0; }
  table.assign-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.assign-table th, table.assign-table td { border: 1px solid #999; padding: 3px 5px; text-align: left; }
  table.assign-table th { background: #ececec; }
  table.assign-table thead { display: table-header-group; }
  table.assign-table tr { page-break-inside: avoid; break-inside: avoid; }
  .blank-cell { min-width: 70px; }
  table.calendar { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
  table.calendar thead { display: table-header-group; }
  table.calendar tr { page-break-inside: avoid; break-inside: avoid; }
  table.calendar th { background: #ececec; padding: 4px; font-size: 11px; border: 1px solid #999; text-align: center; }
  table.calendar td { border: 1px solid #999; vertical-align: top; height: 62px; padding: 3px 4px; font-size: 9px; page-break-inside: avoid; break-inside: avoid; overflow: hidden; }
  .cal-date { font-weight: 700; font-size: 9.5px; }
  .cal-holiday { color: #4472C4; }
  .cal-names { margin-top: 2px; line-height: 1.25; }
  .cal-offday-badge { display: inline-block; margin-top: 2px; padding: 1px 4px; background: #eef2fb; color: #4472C4; border-radius: 4px; font-size: 8px; font-weight: 600; }
</style>
</head>
<body>
  <h1>${escapeHtml(scopeLabel)} 현장전달문서</h1>
  <p class="sub">${year}년 ${month}월 · 지게차 / 현장 근무자용 — 근무하신 날짜의 대체휴무일을 직접 적어 제출해주세요.</p>

  <h2 class="section-title">지게차 근무 확인 및 대체휴무일 기재</h2>
  ${forkliftTableHtml}

  <h2 class="section-title">현장 근무 확인 및 대체휴무일 기재</h2>
  ${fieldColumnsHtml}

  <h2 class="section-title">${month}월 달력</h2>
  <table class="calendar">
    <thead><tr>${weekDayNames.map((w) => `<th>${w}</th>`).join('')}</tr></thead>
    <tbody>${calendarHtml}</tbody>
  </table>
</body></html>`;
}

function onHandoutDownload() {
  if (!currentDraft) return;
  const year = Number(yearSelectEl.value);
  const month = Number(monthSelectEl.value);

  const { forkliftRows, fieldRows } = buildHandoutRows(currentDraft, DATA);
  const draftByDate = new Map(currentDraft.days.map((d) => [d.date, d]));
  const weeks = buildCalendarWeeks(year, month, draftByDate, DATA);
  const html = buildHandoutHtml(year, month, forkliftRows, fieldRows, weeks, getModeLabel(currentDraft.mode));

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    setStatus('팝업이 차단되어 문서를 열 수 없습니다. 브라우저 팝업 차단을 해제해주세요.', 'error');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => { printWindow.focus(); printWindow.print(); };
  if (printWindow.document.fonts && printWindow.document.fonts.ready) {
    printWindow.document.fonts.ready.then(triggerPrint).catch(triggerPrint);
  } else {
    setTimeout(triggerPrint, 300);
  }
}

/* ============================================================
 * 초기화 / 이벤트 바인딩
 * ============================================================ */
async function reloadData() {
  setStatus('데이터를 불러오는 중입니다...', '');
  document.getElementById('btnReload').disabled = true;
  document.getElementById('btnGenerate').disabled = true;
  try {
    DATA = await loadData();
    renderRosterStatus(DATA);
    renderDataWarnings(DATA);
    setStatus('데이터를 불러왔습니다.', 'success');
  } catch (err) {
    setStatus(`데이터 로드 실패: ${err.message}`, 'error');
  } finally {
    document.getElementById('btnReload').disabled = false;
    document.getElementById('btnGenerate').disabled = false;
  }
  resetDraftUi(false);
}

/** 자동배정/다시 배정 후 상태줄에 붙이는 요약 (교대 예외, 월 3회 근무자, 1회 제한 대상 안내) */
function draftSummaryMessage(draft) {
  const { altTotal, altExceptions } = draft.stats;
  const groupLabel = { managers: '관리자', forklift: '지게차', field: '현장' };
  const tallies = computeMonthlyTallies(draft, DATA);
  const maxed = findMaxedOut(tallies);
  const maxedText = LIMIT_GROUPS.flatMap((g) => maxed[g].map((x) => `${x.name}(${groupLabel[g]} ${x.count}회)`)).join(', ');
  const limitedOnce = [];
  const limitedTwice = [];
  LIMIT_GROUPS.forEach((g) => draft.limited[g].forEach((n) => {
    const label = `${n}(${groupLabel[g]})`;
    ((tallies[g].get(n) || 0) >= LIMITED_MONTH_MAX_CAP ? limitedTwice : limitedOnce).push(label);
  }));
  const capMsg = (maxedText ? ` 인원이 모자라 월 ${MONTHLY_MAX_CAP}회 근무가 된 사람: ${maxedText} — 저장하면 다음 달엔 1회만 배정됩니다.` : '')
    + (limitedOnce.length ? ` 지난달 ${MONTHLY_MAX_CAP}회 근무로 이번 달 1회까지만 배정한 사람: ${limitedOnce.join(', ')}.` : '')
    + (limitedTwice.length ? ` 지난달 ${MONTHLY_MAX_CAP}회 근무했지만 인원이 안 맞아 이번 달 2회 배정된 사람: ${limitedTwice.join(', ')}.` : '');
  const altMsg = altExceptions
    ? ` 요일 교대 예외 ${altExceptions}/${altTotal}건 (인원이 모자라 같은 요일을 연속 배정).`
    : '';
  return `${altMsg}${capMsg}`;
}

function onGenerate() {
  if (!DATA) return;
  const year = Number(yearSelectEl.value);
  const month = Number(monthSelectEl.value);
  currentDraft = generateMonthSchedule(year, month, DATA, currentMode);
  renderSchedule(currentDraft, DATA);
  document.getElementById('btnCommit').disabled = false;
  document.getElementById('btnExport').disabled = false;
  document.getElementById('btnHandout').disabled = false;
  setStatus(`[${getModeLabel(currentMode)}] 배정표를 생성했습니다.${draftSummaryMessage(currentDraft)} 저장 전에 검토해주세요.`, 'success');
}

function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    const active = btn.dataset.mode === currentMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setMode(key) {
  if (key === currentMode) return;
  currentMode = key;
  try { localStorage.setItem(MODE_STORAGE_KEY, key); } catch (e) { /* 저장 실패는 무시 */ }
  updateModeButtons();
  resetDraftUi(false);
  if (DATA) renderRosterStatus(DATA);
  setStatus(`[${getModeLabel(key)}] 기준으로 전환했습니다. "자동배정 생성"을 눌러주세요.`, '');
}

function initModeSwitch() {
  const box = document.getElementById('modeSwitch');
  box.innerHTML = MODE_BUTTONS
    .map((b) => `<button type="button" class="mode-btn" data-mode="${escapeHtml(b.key)}">${escapeHtml(b.label)}</button>`)
    .join('');
  box.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  updateModeButtons();
}

document.getElementById('btnReload').addEventListener('click', reloadData);
document.getElementById('btnGenerate').addEventListener('click', onGenerate);
document.getElementById('btnReassign').addEventListener('click', onReassign);
document.getElementById('btnLockAll').addEventListener('click', () => setAllLocks(true));
document.getElementById('btnUnlockAll').addEventListener('click', () => setAllLocks(false));
document.getElementById('btnCommit').addEventListener('click', onCommit);
document.getElementById('btnExport').addEventListener('click', onExport);
document.getElementById('btnHandout').addEventListener('click', onHandoutDownload);
function onPeriodChange() {
  resetDraftUi();
  if (DATA) renderRosterStatus(DATA); // 월이 바뀌면 "1회 제한" 표시도 그 달 기준으로 바뀐다
}
yearSelectEl.addEventListener('change', onPeriodChange);
monthSelectEl.addEventListener('change', onPeriodChange);
initModeSwitch();

/* ============================================================
 * 다크모드 — index.html의 인라인 스크립트가 최초 페인트 전에
 * data-theme을 이미 설정해두므로, 여기서는 토글 클릭만 처리한다.
 * ============================================================ */
const THEME_STORAGE_KEY = 'ff2_theme';

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

/* ============================================================
 * 로그인 게이트 — 서버가 없는 정적 사이트라 실제 보안은 아니고,
 * 아무나 못 들어오게 막는 간단한 화면 가림막입니다.
 * ============================================================ */
const AUTH_STORAGE_KEY = 'ff2_authed_at';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1시간
const VALID_ID = 'fastbox';
const VALID_PW = 'fastbox@001';

function showApp() {
  document.getElementById('loginGate').style.display = 'none';
  initSelectors();
  reloadData();
}

function isSessionValid() {
  const authedAt = Number(localStorage.getItem(AUTH_STORAGE_KEY));
  return Boolean(authedAt) && Date.now() - authedAt < SESSION_DURATION_MS;
}

document.getElementById('loginForm').addEventListener('submit', (evt) => {
  evt.preventDefault();
  const id = document.getElementById('loginId').value.trim();
  const pw = document.getElementById('loginPw').value;
  if (id === VALID_ID && pw === VALID_PW) {
    localStorage.setItem(AUTH_STORAGE_KEY, String(Date.now()));
    document.getElementById('loginError').textContent = '';
    showApp();
  } else {
    document.getElementById('loginError').textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
  }
});

if (isSessionValid()) {
  showApp();
} else {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.getElementById('loginGate').style.display = 'flex';
}
