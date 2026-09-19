'use strict';

/* ============================================================
 * CONFIG — Google Sheets 연동 준비가 끝나면 아래 값을 채우세요.
 * (전부 비어있으면 자동으로 MOCK_DATA로 동작합니다)
 *
 * csv.* : 각 시트를 "파일 > 공유 > 웹에 게시"로 CSV 게시한 URL
 *   - managers : 이름 | 급여형태 | 입사일 | 누적횟수 | 최근근무일 | 제외요일
 *   - forklift : 이름 | 급여형태 | 입사일 | 누적횟수 | 최근근무일 | 제외요일
 *   - field    : 이름 | 소속 | FB | 입사일 | 누적횟수 | 최근근무일 | 제외요일   (FB 컬럼: TRUE/FALSE)
 *   ※ 제외요일 : "일요일" / "토요일" 처럼 그 사람을 절대 배정하면 안 되는 요일. 없으면 빈칸.
 *              여러 개면 "토요일,일요일"처럼 쉼표로 구분.
 *   - tieBreakHistory : 그룹 | 이름
 *   - holidays : 날짜 | 설명
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
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzeXNoXgwrPhQCVXRIEJKGY4ZH2XWZ2U49gxCdB_QScQSITTrpC6g6Efje9zbOaU5y5/exec',
  rules: {
    newHireGraceMonths: 1,
  },
};

function isConfigured() {
  return Object.values(CONFIG.csv).every((u) => u && u.startsWith('http')) &&
    CONFIG.appsScriptUrl.startsWith('http');
}

/* 스케줄근무자: 로테이션 대상 아님, 매주 토~수 자동 근무 (목·금 고정휴무) */
const SCHEDULE_WORKER = {
  name: '차은미(고은)',
  pattern: '매주 토요일~수요일 근무 / 목·금 고정휴무',
};

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
    requiredSat: 4,
    requiredSun: 2,
    minFbPerDay: 1,
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

function normalizeDateString(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return toISODate(d);
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
  return {
    name: (row['이름'] || '').trim(),
    count: Number(row['누적횟수'] || 0),
    lastWorked: normalizeDateString(row['최근근무일']),
    joinDate: normalizeDateString(row['입사일']) || null,
    excludedWeekdays: parseExcludedWeekdays(row['제외요일']),
  };
}

function parseFieldRow(row) {
  const base = parseRosterRow(row);
  const fbRaw = String(row['FB'] || '').trim().toUpperCase();
  return { ...base, fb: fbRaw === 'TRUE' || fbRaw === '1' || fbRaw === 'Y' };
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

async function loadData() {
  const banner = document.getElementById('configBanner');
  if (!isConfigured()) {
    banner.hidden = false;
    return cloneMockData();
  }
  banner.hidden = true;

  const bust = `cachebust=${Date.now()}`;
  const [managersRows, forkliftRows, fieldRows, tieRows, holidayRows] = await Promise.all([
    fetchCsv(CONFIG.csv.managers, bust),
    fetchCsv(CONFIG.csv.forklift, bust),
    fetchCsv(CONFIG.csv.field, bust),
    fetchCsv(CONFIG.csv.tieBreakHistory, bust),
    fetchCsv(CONFIG.csv.holidays, bust),
  ]);

  return {
    managers: { label: '관리자', requiredPerDay: 1, members: managersRows.map(parseRosterRow).filter((m) => m.name) },
    forklift: { label: '지게차', requiredPerDay: 1, members: forkliftRows.map(parseRosterRow).filter((m) => m.name) },
    field: {
      label: '현장',
      requiredSat: 4,
      requiredSun: 2,
      minFbPerDay: 1,
      members: fieldRows.map(parseFieldRow).filter((m) => m.name),
    },
    tieBreakHistory: parseTieBreakRows(tieRows),
    holidays: new Map(
      holidayRows
        .map((r) => [normalizeDateString(r['날짜']), (r['설명'] || '공휴일').trim()])
        .filter(([iso]) => iso)
    ),
  };
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

function rankCandidates(members, eligible, owedSet) {
  return members
    .filter(eligible)
    .slice()
    .sort((a, b) => {
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

function selectTopWithTieBreak(ranked, k, owedSet) {
  const nextOwed = new Set(owedSet);
  if (k <= 0) return { selected: [], owedSet: nextOwed, shortfall: 0 };
  if (ranked.length <= k) {
    ranked.forEach((m) => nextOwed.delete(m.name));
    return { selected: ranked.slice(), owedSet: nextOwed, shortfall: k - ranked.length };
  }
  const selected = ranked.slice(0, k);
  const rest = ranked.slice(k);
  const key = (m) => `${m.count}|${m.lastWorked || ''}`;
  const boundaryKey = key(selected[k - 1]);
  const tiedSelected = selected.filter((m) => key(m) === boundaryKey);
  const tiedRest = rest.filter((m) => key(m) === boundaryKey);
  if (tiedRest.length > 0) {
    tiedSelected.forEach((m) => nextOwed.delete(m.name));
    tiedRest.forEach((m) => nextOwed.add(m.name));
  }
  return { selected, owedSet: nextOwed, shortfall: 0 };
}

function assignSingleSlot(members, date, excludeNames, owedSet) {
  const eligible = (m) => isEligible(m, date) && !excludeNames.has(m.name);
  const ranked = rankCandidates(members, eligible, owedSet);
  const { selected, owedSet: newOwed, shortfall } = selectTopWithTieBreak(ranked, 1, owedSet);
  return { picked: selected.map((m) => m.name), owedSet: newOwed, shortfall };
}

function assignFieldDay(members, minFbPerDay, date, requiredTotal, excludeNames, owedSet) {
  const rotationNeeded = Math.max(0, requiredTotal - 1); // 차은미 고정 1명 제외
  const eligible = (m) => isEligible(m, date) && !excludeNames.has(m.name);
  const ranked = rankCandidates(members, eligible, owedSet);
  let { selected, owedSet: newOwed, shortfall } = selectTopWithTieBreak(ranked, rotationNeeded, owedSet);

  const warnings = [];
  const fbCount = selected.filter((m) => m.fb).length;
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
      warnings.push('FB(월급제·시급제) 인원이 부족해 최소 1명 조건을 채우지 못했습니다.');
    }
  }

  if (shortfall) warnings.push(`현장 인원 부족 (${shortfall}명 미배정)`);

  return { picked: [SCHEDULE_WORKER.name, ...selected.map((m) => m.name)], owedSet: newOwed, warnings };
}

function cloneMembers(members) {
  return members.map((m) => ({ ...m }));
}

function bumpWorkingMembers(members, names, iso) {
  const nameSet = new Set(names.filter((n) => n !== SCHEDULE_WORKER.name));
  members.forEach((m) => {
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

function generateMonthSchedule(year, month, data) {
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
      warnings: [],
    };

    if (isHoliday) {
      days.push(entry);
      continue;
    }

    const prevEntry = dow === 'sun' ? days[days.length - 1] : null;
    const excludeManagers = computeWeekendExclusion(prevEntry, dow, date, 'managers', data);
    const excludeForklift = computeWeekendExclusion(prevEntry, dow, date, 'forklift', data);
    const excludeField = computeWeekendExclusion(prevEntry, dow, date, 'field', data);

    const mgrResult = assignSingleSlot(workingMembers.managers, date, excludeManagers, owed.managers);
    entry.managers = mgrResult.picked;
    owed.managers = mgrResult.owedSet;
    if (mgrResult.shortfall) entry.warnings.push(`관리자 인원 부족 (${mgrResult.shortfall}명 미배정)`);

    const fkResult = assignSingleSlot(workingMembers.forklift, date, excludeForklift, owed.forklift);
    entry.forklift = fkResult.picked;
    owed.forklift = fkResult.owedSet;
    if (fkResult.shortfall) entry.warnings.push(`지게차 인원 부족 (${fkResult.shortfall}명 미배정)`);

    const requiredTotal = dow === 'sat' ? data.field.requiredSat : data.field.requiredSun;
    const fieldResult = assignFieldDay(
      workingMembers.field, data.field.minFbPerDay, date, requiredTotal, excludeField, owed.field
    );
    entry.field = fieldResult.picked;
    owed.field = fieldResult.owedSet;
    entry.warnings.push(...fieldResult.warnings);

    bumpWorkingMembers(workingMembers.managers, entry.managers, iso);
    bumpWorkingMembers(workingMembers.forklift, entry.forklift, iso);
    bumpWorkingMembers(workingMembers.field, entry.field, iso);

    days.push(entry);
  }

  return { days, owed, workingMembers };
}

/* ============================================================
 * 화면 렌더링
 * ============================================================ */
let DATA = null;
let currentDraft = null;

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

function resetDraftUi() {
  currentDraft = null;
  document.getElementById('scheduleContainer').innerHTML =
    '<p class="empty-hint">연도/월을 선택하고 "자동배정 생성"을 눌러주세요.</p>';
  document.getElementById('btnCommit').disabled = true;
  document.getElementById('btnExport').disabled = true;
  setStatus('', '');
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

function buildSlotOptions(draft, dayIdx, group, slotIndex, data) {
  const day = draft.days[dayIdx];
  const date = parseISODate(day.date);
  const members = data[group].members;
  const usedElsewhereThisDay = new Set(day[group].filter((n, idx) => idx !== slotIndex));
  const excluded = getWeekendExcluded(draft, dayIdx, group, data);
  return members
    .filter((m) => isEligible(m, date))
    .filter((m) => !usedElsewhereThisDay.has(m.name))
    .filter((m) => !excluded.has(m.name))
    .map((m) => m.name);
}

function renderSlotSelect(draft, dayIdx, group, slotIndex, data) {
  const day = draft.days[dayIdx];
  const currentName = day[group][slotIndex] || '';
  const options = buildSlotOptions(draft, dayIdx, group, slotIndex, data);
  if (currentName && !options.includes(currentName)) options.unshift(currentName);

  const blankOpt = currentName ? '' : '<option value="">미배정</option>';
  const optsHtml = options
    .map((name) => {
      const label = group === 'field' ? decorateFieldName(name, data) : name;
      return `<option value="${escapeHtml(name)}" ${name === currentName ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');

  return `<select class="slot-select" data-day-idx="${dayIdx}" data-group="${group}" data-slot-index="${slotIndex}">${blankOpt}${optsHtml}</select>`;
}

function renderSchedule(draft, data) {
  const container = document.getElementById('scheduleContainer');
  if (!draft || !draft.days.length) {
    container.innerHTML = '<p class="empty-hint">배정 결과가 없습니다.</p>';
    return;
  }

  const fieldCols = data.field.requiredSat;

  let html = '<table class="schedule-table"><thead><tr>';
  html += '<th>날짜</th><th>관리자</th><th>지게차</th>';
  for (let i = 0; i < fieldCols; i++) html += `<th>현장${i + 1}</th>`;
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
      for (let i = 0; i < fieldCols; i++) {
        if (i === 0) {
          html += `<td><span class="slot-fixed">${escapeHtml(SCHEDULE_WORKER.name)}</span></td>`;
        } else if (i < day.field.length || i < (day.dow === 'sat' ? data.field.requiredSat : data.field.requiredSun)) {
          html += `<td>${renderSlotSelect(draft, dayIdx, 'field', i, data)}</td>`;
        } else {
          html += '<td>—</td>';
        }
      }
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
  currentDraft.days[dayIdx][group][slotIndex] = sel.value;
  renderSchedule(currentDraft, DATA);
  setStatus('슬롯을 수정했습니다. 이후 날짜의 자동배정에는 영향을 주지 않습니다.', 'success');
}

function renderRosterStatus(data) {
  const container = document.getElementById('rosterContainer');
  const groups = [
    { key: 'managers', title: data.managers.label },
    { key: 'forklift', title: data.forklift.label },
    { key: 'field', title: `${data.field.label} (+ ${SCHEDULE_WORKER.name} 고정)` },
  ];

  container.innerHTML = groups
    .map((g) => {
      const members = data[g.key].members
        .slice()
        .sort((a, b) => a.count - b.count || (a.lastWorked || '').localeCompare(b.lastWorked || ''));
      const rows = members
        .map(
          (m) => `
        <tr>
          <td>${escapeHtml(m.name)}${g.key === 'field' && m.fb ? '<span class="fb-tag">FB</span>' : ''}</td>
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
      .filter((name) => name && name !== SCHEDULE_WORKER.name)
      .forEach((name) => {
        bumpDelta(deltas.field, name, day.date);
        scheduleLogRows.push({ date: day.date, weekday, group: data.field.label, name });
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

    const fieldCols = DATA.field.requiredSat;
    const headers = ['날짜', '관리자', '지게차', ...Array.from({ length: fieldCols }, (_, i) => `현장${i + 1}`)];
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
        for (let i = 0; i < fieldCols; i++) rowValues.push(day.field[i] || '');
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
    const fileName = `풀필먼트2팀_근무표_${yearSelectEl.value}${String(monthSelectEl.value).padStart(2, '0')}.xlsx`;
    saveAs(blob, fileName);
    setStatus('엑셀 다운로드가 완료되었습니다.', 'success');
  } catch (err) {
    setStatus(`엑셀 생성 실패: ${err.message}`, 'error');
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
    setStatus('데이터를 불러왔습니다.', 'success');
  } catch (err) {
    setStatus(`데이터 로드 실패: ${err.message}`, 'error');
  } finally {
    document.getElementById('btnReload').disabled = false;
    document.getElementById('btnGenerate').disabled = false;
  }
  resetDraftUi();
}

function onGenerate() {
  if (!DATA) return;
  const year = Number(yearSelectEl.value);
  const month = Number(monthSelectEl.value);
  currentDraft = generateMonthSchedule(year, month, DATA);
  renderSchedule(currentDraft, DATA);
  document.getElementById('btnCommit').disabled = false;
  document.getElementById('btnExport').disabled = false;
  setStatus('배정표를 생성했습니다. 저장 전에 검토해주세요.', 'success');
}

document.getElementById('btnReload').addEventListener('click', reloadData);
document.getElementById('btnGenerate').addEventListener('click', onGenerate);
document.getElementById('btnCommit').addEventListener('click', onCommit);
document.getElementById('btnExport').addEventListener('click', onExport);
yearSelectEl.addEventListener('change', resetDraftUi);
monthSelectEl.addEventListener('change', resetDraftUi);

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
