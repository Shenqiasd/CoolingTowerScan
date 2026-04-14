import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDefaultSurveyWorkspace,
  serializeSurveyWorkspaceDraft,
  type ProjectSurveyWorkspaceDraft,
} from './projectSurveyWorkspace.ts';

test('createDefaultSurveyWorkspace creates editable survey sections with gate validation defaults', () => {
  const workspace = createDefaultSurveyWorkspace('project-1');

  assert.equal(workspace.projectId, 'project-1');
  assert.equal(workspace.completionStatus, 'draft');
  assert.equal(workspace.infoCollection.siteContactName, '');
  assert.equal(workspace.surveyRecord.participantNames.length, 0);
  assert.equal(workspace.equipmentLedger.length, 0);
  assert.equal(workspace.dataGaps.length, 0);
  assert.equal(workspace.handoffs.length, 0);
  assert.equal(workspace.gateValidation.canComplete, false);
});

test('serializeSurveyWorkspaceDraft trims lists and preserves structured rows', () => {
  const draft: ProjectSurveyWorkspaceDraft = {
    ...createDefaultSurveyWorkspace('project-1'),
    infoCollection: {
      siteContactName: '  张工 ',
      siteContactPhone: ' 13800000000 ',
      siteAccessWindow: '工作日 9-18 点',
      operatingSchedule: '  24h  ',
      coolingSystemType: '  开式冷却塔  ',
      powerAccessStatus: '',
      waterTreatmentStatus: '',
      notes: '  先走访动力站  ',
    },
    surveyRecord: {
      surveyDate: '2026-04-20',
      surveyOwnerUserId: ' owner-1 ',
      participantNamesText: ' 张工\n 李工\n\n',
      onSiteFindings: '  有 3 台塔  ',
      loadProfileSummary: '',
      retrofitConstraints: '',
      nextActions: '  整理踏勘报告  ',
    },
    equipmentLedger: [
      {
        id: 'equipment-1',
        equipmentName: '  冷却塔 1# ',
        equipmentType: ' cooling_tower ',
        locationLabel: ' 屋顶 ',
        quantity: '2',
        capacityRt: '450.5',
        status: 'running',
        notes: '  正常运行 ',
      },
    ],
    dataGaps: [
      {
        id: 'gap-1',
        stageCode: 'proposal',
        gapType: 'missing_info',
        title: ' 缺少运行电流 ',
        detail: ' 待业主补充 ',
        status: 'open',
        ownerUserId: ' owner-2 ',
        dueAt: '2026-04-22',
        waiverReason: '',
      },
    ],
    handoffs: [
      {
        id: 'handoff-1',
        fromStage: 'survey',
        toStage: 'proposal',
        title: ' 交接给方案 ',
        detail: ' 含现场照片 ',
        status: 'ready',
        ownerUserId: ' owner-3 ',
        dueAt: '2026-04-23',
      },
    ],
  };

  const payload = serializeSurveyWorkspaceDraft(draft);

  assert.equal(payload.infoCollection.siteContactName, '张工');
  assert.deepEqual(payload.surveyRecord.participantNames, ['张工', '李工']);
  assert.equal(payload.equipmentLedger[0].quantity, 2);
  assert.equal(payload.equipmentLedger[0].capacityRt, 450.5);
  assert.equal(payload.dataGaps[0].stageCode, 'proposal');
  assert.equal(payload.dataGaps[0].title, '缺少运行电流');
  assert.equal(payload.handoffs[0].title, '交接给方案');
});
