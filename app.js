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
 *   - tieBreakHistory : 그룹 | 이름
 *   - holidays : 날짜 | 설명
 * fieldConfigCsv (선택) : 현장 토/일 필요인원을 시트에서 관리하고 싶을 때만 채우기
 *   - 요일 | 필요인원 | 최소FB   (요일: "토"/"일")
 *   - 비워두면 기존과 동일하게 토4/일2/FB최소1로 동작합니다.
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
 * 로테이션 카운트 대상에서는 제외하되, 그 사람의 FB 여부는 그대로 존중한다.
 */
function getScheduleWorkers(members) {
  return members.filter((m) => m.scheduleWorker);
}

function getScheduleWorkerNameSet(members) {
  return new Set(getScheduleWorkers(members).map((m) => m.name));
}

/**
 * 현장 부서별 필요인원 기본값 — FieldConfig 시트에 부서 행이 없을 때만 쓰는 안전장치.
 * 풀필먼트2팀 합산 토5/일3 = 운영1 토2/일1 + 운영2 토3/일2. 고정근무자(차은미 등)는
 * 시트의 부서 칸에 적힌 부서의 인원수에 포함된다. 실제 값은 시트에서 관리한다.
 */
const FIELD_DEPT_DEFAULTS = {
  '운영1': { requiredSat: 2, requiredSun: 1, minFbSat: 1, minFbSun: 1 },
  '운영2': { requiredSat: 3, requiredSun: 2, minFbSat: 1, minFbSun: 1 },
};
const ZERO_FIELD_CFG = { requiredSat: 0, requiredSun: 0, minFbSat: 0, minFbSun: 0 };

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
    minFbSat: vals.reduce((a, v) => Math.max(a, v.minFbSat), 0),
    minFbSun: vals.reduce((a, v) => Math.max(a, v.minFbSun), 0),
  };
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
    requiredPerDay: 1,
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
    requiredPerDay: 1,
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
    legacyTotals: { requiredSat: 4, requiredSun: 2, minFbSat: 1, minFbSun: 1 },
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
  tieBreakHistory: { managers: [], forklift: [], field: [] },
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
    },
    holidays: new Map(MOCK_DATA.holidays),
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

function parseTieBreakRows(rows) {
  const result = { managers: [], forklift: [], field: [] };
  rows.forEach((r) => {
    const group = mapGroupLabelToKey(r['그룹']);
    const name = (r['이름'] || '').trim();
    if (group && name) result[group].push(name);
  });
  return result;
}

/** 빈 칸은 "값 없음"으로 본다 (Number('')는 0이라서 그대로 쓰면 빈 칸이 0명이 된다) */
function parseConfigNumber(v) {
  const s = String(v == null ? '' : v).trim();
  return s === '' ? NaN : Number(s);
}

/**
 * FieldConfig 시트: 요일 | 부서 | 필요인원 | 최소FB
 *  - 부서 칸이 있는 행 → 그 부서의 요일별 필요인원/최소FB (byDept)
 *  - 부서 칸이 없는 옛 형식 행 → 부서 구분 없이 전체 한 팀일 때 쓰는 합계 (legacyTotals)
 *  - 시트에 없는 부서/값은 FIELD_DEPT_DEFAULTS로 채운다
 */
async function loadFieldConfig() {
  const fallback = () => ({ byDept: copyFieldDeptDefaults(), legacyTotals: null, hasDeptRows: false });
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
      const minFb = parseConfigNumber(r['최소FB']);
      const dept = normalizeDept(r['부서']);
      if (dept) {
        result.hasDeptRows = true;
        if (!result.byDept[dept]) result.byDept[dept] = { ...ZERO_FIELD_CFG, minFbSat: 1, minFbSun: 1 };
        if (!Number.isNaN(required)) result.byDept[dept][`required${key}`] = required;
        if (!Number.isNaN(minFb)) result.byDept[dept][`minFb${key}`] = minFb;
      } else {
        sawLegacy = true;
        if (!Number.isNaN(required)) legacy[`required${key}`] = required;
        if (!Number.isNaN(minFb)) legacy[`minFb${key}`] = minFb;
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
      warnings.push('FieldConfig 시트에 "부서" 열이 없어 기본값(운영1 토2·일1 / 운영2 토3·일2)으로 배정합니다.');
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
  const [managersRows, forkliftRows, fieldRows, tieRows, holidayRows, fieldConfig] = await Promise.all([
    fetchCsv(CONFIG.csv.managers, bust),
    fetchCsv(CONFIG.csv.forklift, bust),
    fetchCsv(CONFIG.csv.field, bust),
    fetchCsv(CONFIG.csv.tieBreakHistory, bust),
    fetchCsv(CONFIG.csv.holidays, bust),
    loadFieldConfig(),
  ]);

  const data = {
    managers: { label: '관리자', requiredPerDay: 1, members: managersRows.map((r) => parseRosterRow(r)).filter((m) => m.name) },
    forklift: { label: '지게차', requiredPerDay: 1, members: forkliftRows.map((r) => parseRosterRow(r)).filter((m) => m.name) },
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
  data.warnings = buildDataWarnings(data, {
    fieldHasDeptColumn: fieldRows.length > 0 && '부서' in fieldRows[0],
    configHasDeptRows: fieldConfig.hasDeptRows,
  });
  return data;
}

/* ============================================================
 * 배정 알고리즘
 *
 * 우선순위: 누적횟수 오름차순 → 최근근무일 오름차순(오래전 우선) →
 *           지난 동률에서 밀린 이력(owed) 우선 → 이름순(최종 결정론적 fallback)
 *
 * 현장 그룹은 최소 FB 인원 제약이 있어, 순위대로 뽑은 뒤 부족하면
 * "가장 순위가 낮은 비FB 인원"과 "선발되지 못한 FB 인원 중 최상위"를
 * 교체하는 방식으로 보정합니다. 이 보정 교체는 동률 이력(owed) 계산에는
 * 반영하지 않습니다 — owed는 순수 횟수/최근근무일 동률에 대한 이력이고,
 * FB 제약에 의한 교체는 별개의 하드 룰이기 때문입니다.
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

function lastShiftDow(member) {
  if (!member.lastWorked) return null;
  const day = parseISODate(member.lastWorked).getDay();
  return day === 6 ? 'sat' : day === 0 ? 'sun' : null;
}

/**
 * 요일 교대 규칙: 토요일에 일했으면 다음엔 일요일, 일요일에 일했으면 다음엔 토요일.
 * 직전 근무 요일은 시트의 최근근무일 날짜에서 계산한다.
 *   0 = 교대에 맞음(우선), 1 = 직전과 같은 요일이라 후순위
 * 절대 규칙이 아니라 "우선순위"다 — 현장은 토요일 자리가 일요일보다 많아서
 * (예: 토3·일2) 모두가 엄격히 교대하면 매 주말 토요일 후보가 1명씩 줄어 결국
 * 못 채운다. 그래서 교대에 맞는 사람을 먼저 뽑고, 모자라면 나머지에서 채운다.
 * 제외요일이 있는 사람(지게차 토/일 고정 인원 등)은 애초에 교대할 수 없어서 대상에서 뺀다.
 */
function alternationClass(member, dow) {
  if (!dow) return 0;
  if (member.excludedWeekdays && member.excludedWeekdays.size) return 0;
  return lastShiftDow(member) === dow ? 1 : 0;
}

function tieKeyFor(dow) {
  return (m) => `${alternationClass(m, dow)}|${m.count}|${m.lastWorked || ''}`;
}

function rankCandidates(members, eligible, owedSet, dow) {
  const candidates = members.filter(eligible);
  const cls = new Map(candidates.map((m) => [m.name, alternationClass(m, dow)]));
  return candidates
    .slice()
    .sort((a, b) => {
      const ca = cls.get(a.name);
      const cb = cls.get(b.name);
      if (ca !== cb) return ca - cb;
      if (a.count !== b.count) return a.count - b.count;
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

function countAlternationExceptions(selected, dow) {
  return selected.filter((m) => alternationClass(m, dow) === 1).length;
}

function assignSingleSlot(members, date, dow, excludeNames, owedSet) {
  const eligible = (m) => isEligible(m, date) && !excludeNames.has(m.name);
  const ranked = rankCandidates(members, eligible, owedSet, dow);
  const { selected, owedSet: newOwed, shortfall } = selectTopWithTieBreak(ranked, 1, owedSet, tieKeyFor(dow));
  return {
    picked: selected.map((m) => m.name),
    owedSet: newOwed,
    shortfall,
    altTotal: selected.length,
    altExceptions: countAlternationExceptions(selected, dow),
  };
}

function assignFieldDay(members, minFbPerDay, date, dow, requiredTotal, excludeNames, owedSet, label) {
  const scheduleWorkers = getScheduleWorkers(members); // 고정근무자는 로테이션 대상 아님, 매일 자동 포함
  const rotationPool = members.filter((m) => !m.scheduleWorker);
  const rotationNeeded = Math.max(0, requiredTotal - scheduleWorkers.length);
  const eligible = (m) => isEligible(m, date) && !excludeNames.has(m.name);
  const ranked = rankCandidates(rotationPool, eligible, owedSet, dow);
  let { selected, owedSet: newOwed, shortfall } = selectTopWithTieBreak(ranked, rotationNeeded, owedSet, tieKeyFor(dow));

  const warnings = [];
  const fbCount = scheduleWorkers.filter((m) => m.fb).length + selected.filter((m) => m.fb).length;
  if (fbCount < minFbPerDay && rotationNeeded > 0) {
    const selectedNames = new Set(selected.map((m) => m.name));
    const bestFbOutside = ranked.find((m) => m.fb && !selectedNames.has(m.name));
    if (bestFbOutside) {
      let removeIdx = -1;
      for (let i = selected.length - 1; i >= 0; i--) {
        if (!selected[i].fb) { removeIdx = i; break; }
      }
      selected = selected.slice();
      if (removeIdx >= 0) selected.splice(removeIdx, 1, bestFbOutside);
      else selected.push(bestFbOutside);
    } else {
      warnings.push(`${label} FB(월급제·시급제) 인원이 부족해 최소 ${minFbPerDay}명 조건을 채우지 못했습니다.`);
    }
  }

  if (shortfall) warnings.push(`${label} 인원 부족 (${shortfall}명 미배정)`);

  return {
    picked: [...scheduleWorkers.map((m) => m.name), ...selected.map((m) => m.name)],
    owedSet: newOwed,
    warnings,
    altTotal: selected.length,
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

// 한 사람이 한 달에 배정될 수 있는 최대 횟수 (그룹별 독립).
// 지게차는 인원이 5명뿐이라 2회로 두면 여유가 전혀 없어서(5명×2=10자리인데
// 토·일 합쳐 10일까지 있는 달엔 규칙9와 맞물려 못 채우는 날이 생김) 3회로 둔다.
const MONTHLY_CAP_BY_GROUP = { managers: 2, forklift: 3, field: 2 };

/** 입사 후 유예기간(기본 1개월)이 끝나 처음 배정 대상에 들어가는 바로 그 달인지 */
function isFirstEligibleMonth(member, year, month) {
  if (!member.joinDate) return false;
  const graceDate = addMonths(parseISODate(member.joinDate), CONFIG.rules.newHireGraceMonths);
  return graceDate.getFullYear() === year && graceDate.getMonth() === month - 1;
}

function namesAtMonthlyCap(monthlyMap, group, members, year, month) {
  const groupCap = MONTHLY_CAP_BY_GROUP[group];
  const memberByName = new Map(members.map((m) => [m.name, m]));
  const result = new Set();
  monthlyMap.forEach((c, name) => {
    const member = memberByName.get(name);
    // 신규 입사자는 처음 배정 대상이 되는 달엔 그룹 상한 대신 1회로 더 천천히 적응시킨다.
    const cap = member && isFirstEligibleMonth(member, year, month) ? 1 : groupCap;
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

function generateMonthSchedule(year, month, data, mode = currentMode) {
  const dates = getWeekendDatesInMonth(year, month);
  const workingMembers = {
    managers: cloneMembers(data.managers.members),
    forklift: cloneMembers(data.forklift.members),
    field: cloneMembers(data.field.members),
  };
  const owed = {
    managers: new Set(data.tieBreakHistory.managers),
    forklift: new Set(data.tieBreakHistory.forklift),
    field: new Set(data.tieBreakHistory.field),
  };
  // 이번 달 동안 각 사람이 몇 번 배정됐는지 — 월별 상한(2회) 체크용.
  // 고정근무자는 상한 대상이 아니라서 애초에 여기 안 쌓는다.
  const monthlyPicks = { managers: new Map(), forklift: new Map(), field: new Map() };
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
    const excludeManagers = new Set([
      ...computeWeekendExclusion(prevEntry, dow, date, 'managers', data),
      ...namesAtMonthlyCap(monthlyPicks.managers, 'managers', workingMembers.managers, year, month),
    ]);
    const excludeForklift = new Set([
      ...computeWeekendExclusion(prevEntry, dow, date, 'forklift', data),
      ...namesAtMonthlyCap(monthlyPicks.forklift, 'forklift', workingMembers.forklift, year, month),
    ]);
    const excludeField = new Set([
      ...computeWeekendExclusion(prevEntry, dow, date, 'field', data),
      ...namesAtMonthlyCap(monthlyPicks.field, 'field', workingMembers.field, year, month),
    ]);

    const mgrResult = assignSingleSlot(workingMembers.managers, date, dow, excludeManagers, owed.managers);
    entry.managers = mgrResult.picked;
    owed.managers = mgrResult.owedSet;
    if (mgrResult.shortfall) entry.warnings.push(`관리자 인원 부족 (${mgrResult.shortfall}명 미배정)`);
    stats.altTotal += mgrResult.altTotal;
    stats.altExceptions += mgrResult.altExceptions;

    const fkResult = assignSingleSlot(workingMembers.forklift, date, dow, excludeForklift, owed.forklift);
    entry.forklift = fkResult.picked;
    owed.forklift = fkResult.owedSet;
    if (fkResult.shortfall) entry.warnings.push(`지게차 인원 부족 (${fkResult.shortfall}명 미배정)`);
    stats.altTotal += fkResult.altTotal;
    stats.altExceptions += fkResult.altExceptions;

    pools.forEach((pool) => {
      const poolMembers = workingMembers.field.filter((m) => poolIncludes(pool, m));
      const required = dow === 'sat' ? pool.requiredSat : pool.requiredSun;
      const minFb = dow === 'sat' ? pool.minFbSat : pool.minFbSun;
      const label = pool.dept ? `현장(${pool.dept})` : '현장';
      const fieldResult = assignFieldDay(
        poolMembers, minFb, date, dow, required, excludeField, owed.field, label
      );
      entry.fieldByDept[pool.key] = fieldResult.picked;
      owed.field = fieldResult.owedSet;
      entry.warnings.push(...fieldResult.warnings);
      stats.altTotal += fieldResult.altTotal;
      stats.altExceptions += fieldResult.altExceptions;
    });
    syncFlatField(entry, pools);

    bumpWorkingMembers(workingMembers.managers, entry.managers, iso);
    bumpWorkingMembers(workingMembers.forklift, entry.forklift, iso);
    bumpWorkingMembers(workingMembers.field, entry.field, iso);

    bumpMonthlyPicks(monthlyPicks.managers, entry.managers);
    bumpMonthlyPicks(monthlyPicks.forklift, entry.forklift);
    bumpMonthlyPicks(monthlyPicks.field, entry.field, fieldScheduleWorkerNames);

    days.push(entry);
  }

  return { days, owed, workingMembers, pools, mode, stats };
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
  return `<select class="slot-select" data-day-idx="${dayIdx}" data-group="${group}" data-slot-index="${slotIndex}"${poolAttr}>${blankOpt}${optsHtml}</select>`;
}

function renderSchedule(draft, data) {
  const container = document.getElementById('scheduleContainer');
  if (!draft || !draft.days.length) {
    container.innerHTML = '<p class="empty-hint">배정 결과가 없습니다.</p>';
    return;
  }

  const pools = draft.pools;
  const multiPool = pools.length > 1;
  const fieldCols = pools.reduce((sum, p) => sum + p.cols, 0);

  let html = '<table class="schedule-table"><thead><tr>';
  html += '<th>날짜</th><th>관리자</th><th>지게차</th>';
  pools.forEach((p) => {
    for (let i = 0; i < p.cols; i++) html += `<th>${multiPool ? `${escapeHtml(p.dept)} ` : ''}현장${i + 1}</th>`;
  });
  html += '</tr></thead><tbody>';

  draft.days.forEach((day, dayIdx) => {
    const weekdayLabel = day.dow === 'sat' ? '토' : '일';
    const rowClass = day.isHoliday ? 'is-holiday' : '';
    const dateCellClass = day.isHoliday ? 'date-cell holiday-text' : 'date-cell';

    html += `<tr class="${rowClass}">`;
    html += `<td class="${dateCellClass}">${formatKoreanDate(day.date)}(${weekdayLabel})</td>`;

    if (day.isHoliday) {
      html += `<td colspan="${2 + fieldCols}" class="holiday-row-label">공휴일 휴무 (${escapeHtml(day.holidayLabel)})</td>`;
    } else {
      html += `<td>${renderSlotSelect(draft, dayIdx, 'managers', 0, data)}</td>`;
      html += `<td>${renderSlotSelect(draft, dayIdx, 'forklift', 0, data)}</td>`;
      pools.forEach((pool) => {
        const picks = day.fieldByDept[pool.key] || [];
        const required = day.dow === 'sat' ? pool.requiredSat : pool.requiredSun;
        for (let i = 0; i < pool.cols; i++) {
          if (i < picks.length || i < required) {
            html += `<td>${renderSlotSelect(draft, dayIdx, 'field', i, data, pool)}</td>`;
          } else {
            html += '<td>—</td>';
          }
        }
      });
    }
    html += '</tr>';

    if (!day.isHoliday && day.warnings.length) {
      html += `<tr class="${rowClass}"><td></td><td colspan="${1 + fieldCols}">`;
      html += day.warnings.map((w) => `<span class="warn-tag">${escapeHtml(w)}</span>`).join(' ');
      html += '</td></tr>';
    }
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('select.slot-select').forEach((sel) => {
    sel.addEventListener('change', onSlotChange);
  });
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
  renderSchedule(currentDraft, DATA);
  setStatus('슬롯을 수정했습니다. 이후 날짜의 자동배정에는 영향을 주지 않습니다.', 'success');
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
          <td>${escapeHtml(m.name)}${g.key === 'field' && m.fb ? '<span class="fb-tag">FB</span>' : ''}${g.key === 'field' && showDeptTag && m.dept ? `<span class="dept-tag">${escapeHtml(m.dept)}</span>` : ''}</td>
          <td class="num">${m.count}</td>
          <td>${m.lastWorked || '-'}</td>
        </tr>`
        )
        .join('');
      return `
      <div class="roster-card">
        <h3>${escapeHtml(g.title)}</h3>
        <table class="roster-table">
          <thead><tr><th>이름</th><th>누적</th><th>최근근무일</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join('');
}

/* ============================================================
 * 저장 (Apps Script POST) / 엑셀 다운로드
 * ============================================================ */
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

  return {
    rosterUpdates,
    scheduleLogRows,
    tieBreakHistory: {
      managers: Array.from(draft.owed.managers),
      forklift: Array.from(draft.owed.forklift),
      field: Array.from(draft.owed.field),
    },
  };
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
  data.tieBreakHistory = payload.tieBreakHistory;
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
    const fieldCols = pools.reduce((sum, p) => sum + p.cols, 0);
    const fieldHeaders = pools.flatMap((p) =>
      Array.from({ length: p.cols }, (_, i) => `${multiPool ? `${p.dept} ` : ''}현장${i + 1}`)
    );
    const headers = ['날짜', '관리자', '지게차', ...fieldHeaders];
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
        rowValues.push(`공휴일 휴무 (${day.holidayLabel})`, '', ...Array(fieldCols).fill(''));
      } else {
        rowValues.push(day.managers[0] || '', day.forklift[0] || '');
        pools.forEach((p) => {
          const picks = day.fieldByDept[p.key] || [];
          for (let i = 0; i < p.cols; i++) rowValues.push(picks[i] || '');
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
    if (day.forklift[0]) forkliftRows.push({ date: dateLabel, name: day.forklift[0] });
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
      if (entry.forklift[0]) names.push(entry.forklift[0]);
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

  // 지게차는 하루 1명뿐이라 표 하나로 충분하고, 현장은 인원이 많아서
  // 한 페이지에 들어가도록 좌우 2단으로 나눠서 배치한다.
  const forkliftTableHtml = buildAssignColumnHtml(forkliftRows);
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

function onGenerate() {
  if (!DATA) return;
  const year = Number(yearSelectEl.value);
  const month = Number(monthSelectEl.value);
  currentDraft = generateMonthSchedule(year, month, DATA, currentMode);
  renderSchedule(currentDraft, DATA);
  document.getElementById('btnCommit').disabled = false;
  document.getElementById('btnExport').disabled = false;
  document.getElementById('btnHandout').disabled = false;
  const { altTotal, altExceptions } = currentDraft.stats;
  const altMsg = altExceptions
    ? ` 요일 교대 예외 ${altExceptions}/${altTotal}건 (인원이 모자라 같은 요일을 연속 배정).`
    : '';
  setStatus(`[${getModeLabel(currentMode)}] 배정표를 생성했습니다.${altMsg} 저장 전에 검토해주세요.`, 'success');
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
document.getElementById('btnCommit').addEventListener('click', onCommit);
document.getElementById('btnExport').addEventListener('click', onExport);
document.getElementById('btnHandout').addEventListener('click', onHandoutDownload);
yearSelectEl.addEventListener('change', () => resetDraftUi());
monthSelectEl.addEventListener('change', () => resetDraftUi());
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
