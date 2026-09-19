/**
 * 풀필먼트2팀 주말근무표 - 쓰기 전용 백엔드
 *
 * 설치 방법:
 * 1) 근무표로 쓸 Google Sheet를 열고 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 2) 기본으로 생성된 Code.gs 내용을 전부 지우고 이 파일 내용을 붙여넣기
 * 3) 저장 후 [배포] > [새 배포] > 유형: 웹 앱
 *      - 설명: 아무거나 (예: schedule-api)
 *      - 다음 사용자 권한으로 실행: 나(본인 계정)
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 * 4) 배포 후 나오는 웹 앱 URL(.../exec)을 복사해서 app.js의 CONFIG.appsScriptUrl 에 붙여넣기
 *
 * 이 스크립트는 스프레드시트에 "바인딩"되어 있어야 합니다 (시트에서 직접 Apps Script를 열어야
 * SpreadsheetApp.getActiveSpreadsheet() 가 이 시트를 가리킵니다).
 *
 * 필요한 시트(탭) 이름과 헤더 행 구성은 대화창에서 안내한 설정 가이드를 참고하세요.
 */

function doPost(e) {
  var result = { ok: true };
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (payload.rosterUpdates) {
      updateRoster_(ss, 'Managers', payload.rosterUpdates.managers);
      updateRoster_(ss, 'Forklift', payload.rosterUpdates.forklift);
      updateRoster_(ss, 'Field', payload.rosterUpdates.field);
    }
    if (payload.scheduleLogRows && payload.scheduleLogRows.length) {
      appendScheduleLog_(ss, payload.scheduleLogRows);
    }
    if (payload.tieBreakHistory) {
      updateTieBreakHistory_(ss, payload.tieBreakHistory);
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  // GAS 웹앱은 커스텀 헤더를 못 붙이지만, ContentService 응답은 기본적으로
  // 브라우저 fetch에서 cross-origin 으로 읽을 수 있습니다 (text/plain 요청과 짝이 맞아야 preflight 회피).
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'schedule write API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** sheetName 시트에서 '이름' 컬럼으로 행을 찾아 누적횟수/최근근무일을 갱신 */
function updateRoster_(ss, sheetName, updates) {
  if (!updates || !updates.length) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);

  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var nameCol = header.indexOf('이름');
  var countCol = header.indexOf('누적횟수');
  var lastWorkedCol = header.indexOf('최근근무일');
  if (nameCol < 0 || countCol < 0 || lastWorkedCol < 0) {
    throw new Error(sheetName + ' 시트 헤더에 이름/누적횟수/최근근무일 컬럼이 필요합니다.');
  }

  var rowIndexByName = {};
  for (var r = 1; r < data.length; r++) {
    rowIndexByName[String(data[r][nameCol]).trim()] = r;
  }

  updates.forEach(function (u) {
    var r = rowIndexByName[String(u.name).trim()];
    if (r === undefined) return; // 시트에 없는 이름은 조용히 무시 (오타 방지는 화면 쪽에서 처리)
    sheet.getRange(r + 1, countCol + 1).setValue(u.count);
    sheet.getRange(r + 1, lastWorkedCol + 1).setValue(u.lastWorked);
  });
}

/** ScheduleLog 시트 맨 아래에 확정된 배정 내역을 추가 */
function appendScheduleLog_(ss, rows) {
  var sheet = ss.getSheetByName('ScheduleLog');
  if (!sheet) throw new Error('ScheduleLog 시트를 찾을 수 없습니다.');

  var values = rows.map(function (row) {
    return [row.date, row.weekday, row.group, row.name];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, 4).setValues(values);
}

/** TieBreakHistory 시트를 그룹별 '우선권 대기' 명단으로 통째로 덮어씀 */
function updateTieBreakHistory_(ss, tieBreakHistory) {
  var sheet = ss.getSheetByName('TieBreakHistory');
  if (!sheet) throw new Error('TieBreakHistory 시트를 찾을 수 없습니다.');

  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['그룹', '이름']]);

  var rows = [];
  Object.keys(tieBreakHistory).forEach(function (group) {
    (tieBreakHistory[group] || []).forEach(function (name) {
      rows.push([group, name]);
    });
  });
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
}
